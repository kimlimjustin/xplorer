/**
 * Xplorer AI Chat Extension
 *
 * A self-contained AI chat assistant panel that registers via Sidebar.register().
 * Uses the Extension SDK's ai.chat(), ai.getModels(), and ai.checkOllamaStatus() APIs.
 * All styles are inline (no Tailwind). All icons are inline SVG (no lucide-react).
 */

import React from 'react';
import { Sidebar, type XplorerAPI, type SidebarRenderProps } from '@xplorer/extension-sdk';

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  model?: string;
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  available: boolean;
}

// ── Simple Markdown Renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
  // Split into blocks by double newline
  const blocks = text.split(/\n\n+/);
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Fenced code block (```...```)
    if (block.startsWith('```')) {
      const lines = block.split('\n');
      const lang = lines[0].replace(/^```/, '').trim();
      const codeLines = [];
      let closed = false;
      for (let j = 1; j < lines.length; j++) {
        if (lines[j].trimEnd() === '```') {
          closed = true;
          break;
        }
        codeLines.push(lines[j]);
      }
      // If not closed, check subsequent blocks
      if (!closed) {
        let k = i + 1;
        while (k < blocks.length) {
          const subLines = blocks[k].split('\n');
          for (const sl of subLines) {
            if (sl.trimEnd() === '```') {
              closed = true;
              break;
            }
            codeLines.push(sl);
          }
          if (closed) { i = k; break; }
          codeLines.push(''); // re-add paragraph break
          k++;
        }
        if (!closed) i = k - 1;
      }

      elements.push(
        <div key={i} style={{ position: 'relative', margin: '8px 0' }}>
          {lang && (
            <div style={{
              fontSize: 10, color: 'var(--xp-text-muted)', padding: '2px 8px',
              backgroundColor: 'var(--xp-surface)', borderTopLeftRadius: 6, borderTopRightRadius: 6,
              borderBottom: '1px solid var(--xp-border)',
            }}>
              {lang}
            </div>
          )}
          <pre style={{
            margin: 0, padding: 8, fontSize: 12, lineHeight: 1.5,
            backgroundColor: 'var(--xp-surface)',
            borderRadius: lang ? '0 0 6px 6px' : 6,
            overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
          }}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>,
      );
      continue;
    }

    // Heading
    const headingMatch = block.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const sizes = { 1: 16, 2: 14, 3: 13 } as Record<number, number>;
      elements.push(
        <div key={i} style={{ fontSize: sizes[level] || 13, fontWeight: 600, margin: '8px 0 4px' }}>
          {renderInline(headingMatch[2])}
        </div>,
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s/.test(block.trim())) {
      const items = block.split('\n').filter((l) => l.trim());
      elements.push(
        <ul key={i} style={{ margin: '4px 0', paddingLeft: 20 }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: 2 }}>
              {renderInline(item.replace(/^[-*]\s+/, ''))}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(block.trim())) {
      const items = block.split('\n').filter((l) => l.trim());
      elements.push(
        <ol key={i} style={{ margin: '4px 0', paddingLeft: 20 }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: 2 }}>
              {renderInline(item.replace(/^\d+\.\s+/, ''))}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Blockquote
    if (block.startsWith('>')) {
      const text = block.replace(/^>\s?/gm, '');
      elements.push(
        <blockquote key={i} style={{
          borderLeft: '3px solid var(--xp-blue)', paddingLeft: 10, margin: '8px 0',
          color: 'var(--xp-text-muted)', fontStyle: 'italic',
        }}>
          {renderInline(text)}
        </blockquote>,
      );
      continue;
    }

    // Paragraph (default)
    elements.push(
      <p key={i} style={{ margin: '4px 0', lineHeight: 1.5 }}>
        {renderInline(block)}
      </p>,
    );
  }

  return elements;
}

/** Render inline markdown: bold, italic, code, links */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Match: **bold**, *italic*, `code`, [text](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold
      parts.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3]) {
      // Italic
      parts.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4]) {
      // Inline code
      parts.push(
        <code key={match.index} style={{
          backgroundColor: 'var(--xp-surface)', padding: '1px 4px', borderRadius: 3,
          fontSize: '0.9em', fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
        }}>
          {match[4]}
        </code>,
      );
    } else if (match[5] && match[6]) {
      // Link
      parts.push(
        <a key={match.index} href={match[6]} style={{ color: 'var(--xp-blue)', textDecoration: 'underline' }}
          target="_blank" rel="noopener noreferrer">
          {match[5]}
        </a>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : parts;
}

// ── Inline SVG Icons ─────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 20 20" fill="currentColor" style={{ opacity: 0.5 }}>
      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
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

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

// ── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const modelLabel = message.model
    ? message.model.replace('claude-', '').replace('deepseek-', 'ds-').substring(0, 20)
    : null;

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{
        maxWidth: '85%', minWidth: 0, borderRadius: 8, padding: 10, fontSize: 13,
        overflow: 'hidden', wordBreak: 'break-word',
        ...(isUser
          ? { backgroundColor: 'var(--xp-blue)', color: '#fff' }
          : { backgroundColor: 'var(--xp-bg)', border: '1px solid var(--xp-border)' }),
      }}>
        {isUser ? (
          <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
        ) : (
          <>
            {renderMarkdown(message.content)}
            {modelLabel && (
              <div style={{ marginTop: 6, fontSize: 10, color: 'var(--xp-text-muted)', opacity: 0.6 }}>
                {modelLabel}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Loading Indicator ────────────────────────────────────────────────────────

function LoadingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
      <div style={{
        backgroundColor: 'var(--xp-bg)', border: '1px solid var(--xp-border)',
        borderRadius: 8, padding: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--xp-blue)', animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--xp-blue)', animation: 'pulse 1.5s infinite 0.2s' }} />
          <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--xp-blue)', animation: 'pulse 1.5s infinite 0.4s' }} />
          <span style={{ fontSize: 12, color: 'var(--xp-text-muted)', marginLeft: 4 }}>Thinking...</span>
        </div>
      </div>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', color: 'var(--xp-text-muted)', padding: '32px 16px' }}>
      <ChatBubbleIcon />
      <p style={{ fontWeight: 500, margin: '8px 0 4px' }}>AI Chat Assistant</p>
      <p style={{ fontSize: 12, margin: 0 }}>Ask questions about your files, get help with organization, or just chat.</p>
    </div>
  );
}

// ── Main Chat Panel ──────────────────────────────────────────────────────────

let chatApi: XplorerAPI;

// Module-level messages — immune to sandbox hook issues
let _aiChatMessages: ChatMessage[] = [];

function AIChatPanel(_props: SidebarRenderProps) {
  const [, _forceRender] = React.useState(0);
  const messages = _aiChatMessages;
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [models, setModels] = React.useState<AIModel[]>([]);
  const [selectedModel, setSelectedModel] = React.useState('claude-sonnet-4-6');
  const [ollamaConnected, setOllamaConnected] = React.useState(false);
  const [showModelDropdown, setShowModelDropdown] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Cloud models that are always available for selection
  const cloudModels: Array<{ id: string; name: string }> = [
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'o3-mini', name: 'o3-mini' },
  ];

  // Load models on mount
  React.useEffect(() => {
    if (!chatApi) return;

    const load = async () => {
      try {
        const available = await chatApi.ai.getModels();
        setModels(available);
        const status = await chatApi.ai.checkOllamaStatus();
        setOllamaConnected(status);
      } catch (err) {
        console.error('[AI Chat Extension] Failed to load models:', err);
      }
    };
    load();
  }, []);

  // Auto-scroll
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const allModelOptions = React.useMemo(() => {
    const cloudIds = new Set(cloudModels.map((m) => m.id));
    const localModels = models
      .filter((m) => !cloudIds.has(m.id) && !m.id.startsWith('claude-') && !m.id.startsWith('gpt-') && !m.id.startsWith('o3'))
      .map((m) => ({ id: m.id, name: m.name }));
    return [...cloudModels, ...localModels];
  }, [models]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || !chatApi) return;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    _aiChatMessages = [..._aiChatMessages, userMsg];
    _forceRender((n) => n + 1);
    setInput('');
    setIsLoading(true);

    try {
      const conversationHistory = [..._aiChatMessages].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await chatApi.ai.chat(conversationHistory);

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        model: selectedModel,
      };
      _aiChatMessages = [..._aiChatMessages, assistantMsg];
      _forceRender((n) => n + 1);
    } catch (err: unknown) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      };
      _aiChatMessages = [..._aiChatMessages, errorMsg];
      _forceRender((n) => n + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearMessages = () => {
    _aiChatMessages = [];
    _forceRender((n) => n + 1);
  };

  // Inject pulse animation style
  React.useEffect(() => {
    const styleId = 'ai-chat-ext-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .ai-chat-ext-textarea:focus {
          outline: none;
          border-color: var(--xp-blue) !important;
        }
        .ai-chat-ext-btn:hover {
          opacity: 0.85;
        }
        .ai-chat-ext-model-btn:hover {
          background-color: var(--xp-surface-light) !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const statusColor = ollamaConnected ? 'var(--xp-green)' : 'var(--xp-orange)';
  const statusText = ollamaConnected ? 'AI Connected' : 'Cloud Only';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: '1 1 0%',
      minHeight: 0, overflow: 'hidden', fontFamily: 'sans-serif',
      color: 'var(--xp-text)',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid var(--xp-border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>AI Chat</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {(messages || []).length > 0 && (
              <button
                onClick={clearMessages}
                title="Clear chat"
                style={{
                  padding: 3, cursor: 'pointer', display: 'flex', alignItems: 'center',
                  backgroundColor: 'transparent', border: 'none', color: 'var(--xp-text-muted)',
                  borderRadius: 4,
                }}
                className="ai-chat-ext-btn"
              >
                <TrashIcon />
              </button>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              title={showSettings ? 'Hide settings' : 'Show settings'}
              style={{
                padding: 3, cursor: 'pointer', display: 'flex', alignItems: 'center',
                backgroundColor: showSettings ? 'var(--xp-surface-light)' : 'transparent',
                border: 'none', color: 'var(--xp-text-muted)', borderRadius: 4,
              }}
              className="ai-chat-ext-btn"
            >
              <SettingsIcon />
            </button>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', backgroundColor: statusColor, flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, color: 'var(--xp-text-muted)', whiteSpace: 'nowrap' }}>
              {statusText}
            </span>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div style={{ marginTop: 8 }}>
            {/* Model Selector */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '6px 10px', fontSize: 12,
                  backgroundColor: 'var(--xp-bg)', border: '1px solid var(--xp-border)',
                  borderRadius: 6, cursor: 'pointer', color: 'var(--xp-text)', gap: 6,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {allModelOptions.find((m) => m.id === selectedModel)?.name || selectedModel}
                </span>
                <ChevronDownIcon />
              </button>

              {showModelDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                  backgroundColor: 'var(--xp-bg)', border: '1px solid var(--xp-border)',
                  borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  zIndex: 100, maxHeight: 240, overflowY: 'auto',
                }}>
                  {allModelOptions.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setShowModelDropdown(false);
                      }}
                      className="ai-chat-ext-model-btn"
                      style={{
                        width: '100%', padding: '7px 10px', fontSize: 12, textAlign: 'left',
                        border: 'none', cursor: 'pointer',
                        backgroundColor: selectedModel === model.id ? 'rgba(122, 162, 247, 0.15)' : 'transparent',
                        color: selectedModel === model.id ? 'var(--xp-blue)' : 'var(--xp-text)',
                      }}
                    >
                      {model.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Compact model info when settings collapsed */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 6, fontSize: 11, color: 'var(--xp-text-muted)',
            }}>
              <span>Messages: {(messages || []).length}</span>
              <span>{ollamaConnected ? 'Local + Cloud models' : 'Cloud models only'}</span>
            </div>
          </div>
        )}

        {/* Compact Model Label when settings hidden */}
        {!showSettings && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 11, color: 'var(--xp-text-muted)',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Model: {selectedModel.replace('claude-', '').substring(0, 16)}
            </span>
            <span>{(messages || []).length > 0 ? `${(messages || []).length} msgs` : ''}</span>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div style={{
        flex: '1 1 0%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
        padding: '12px 10px',
      }}>
        {(messages || []).length === 0 && !isLoading ? (
          <EmptyState />
        ) : (
          (messages || []).map((msg, i) => (
            <MessageBubble key={`${msg.role}-${msg.timestamp}-${i}`} message={msg} />
          ))
        )}

        {isLoading && <LoadingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '8px 10px', borderTop: '1px solid var(--xp-border)', flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 6,
          backgroundColor: 'var(--xp-bg)', border: '1px solid var(--xp-border)',
          borderRadius: 8, padding: '6px 8px',
        }}>
          <textarea
            ref={textareaRef}
            className="ai-chat-ext-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? 'Waiting for response...' : 'Ask a question...'}
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1, resize: 'none', border: 'none', outline: 'none',
              backgroundColor: 'transparent', color: 'var(--xp-text)',
              fontSize: 13, lineHeight: 1.4, padding: '2px 0',
              fontFamily: 'inherit', maxHeight: 120, minHeight: 20,
            }}
          />
          {isLoading ? (
            <button
              onClick={() => setIsLoading(false)}
              title="Stop"
              style={{
                padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', backgroundColor: 'var(--xp-red)', border: 'none',
                borderRadius: 6, color: '#fff', flexShrink: 0, width: 28, height: 28,
              }}
            >
              <StopIcon />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              title="Send (Enter)"
              className="ai-chat-ext-btn"
              style={{
                padding: 4, cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: input.trim() ? 'var(--xp-blue)' : 'var(--xp-surface-light)',
                border: 'none', borderRadius: 6,
                color: input.trim() ? '#fff' : 'var(--xp-text-muted)',
                flexShrink: 0, width: 28, height: 28,
                opacity: input.trim() ? 1 : 0.5,
              }}
            >
              <SendIcon />
            </button>
          )}
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 4,
          fontSize: 10, color: 'var(--xp-text-muted)',
        }}>
          <span>Shift+Enter for new line</span>
          <span>{selectedModel.split('-').slice(0, 2).join('-')}</span>
        </div>
      </div>

      {/* Overlay to close dropdowns */}
      {showModelDropdown && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          onClick={() => setShowModelDropdown(false)}
        />
      )}
    </div>
  );
}

// ── Register the Extension ───────────────────────────────────────────────────

Sidebar.register({
  id: 'ai-chat',
  title: 'AI Chat',
  description: 'Chat with AI about your files',
  icon: 'message-circle',
  location: 'right',
  permissions: ['ai:read', 'ai:chat', 'file:read', 'ui:panels'],
  render: (props) => React.createElement(AIChatPanel, props),
  onActivate: (api) => {
    chatApi = api;
  },
});
