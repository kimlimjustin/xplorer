import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Sidebar, Command, useCurrentPath, useSelectedFiles, type XplorerAPI } from '@xplorer/extension-sdk';

let api: XplorerAPI;

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

const s = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    color: 'var(--xp-text, #c0caf5)',
    fontSize: 13,
  },
  header: {
    padding: '10px 12px',
    borderBottom: '1px solid rgba(var(--xp-border-rgb, 41, 46, 66), 0.5)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    background: 'linear-gradient(135deg, #d97706, #f59e0b)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: 11,
    color: '#fff',
    fontWeight: 700 as const,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: 600 as const,
  },
  messages: {
    flex: 1,
    overflow: 'auto' as const,
    padding: '8px 0',
  },
  message: {
    padding: '6px 12px',
    fontSize: 12,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  userMsg: {
    color: 'var(--xp-text, #c0caf5)',
    backgroundColor: 'rgba(122, 162, 247, 0.08)',
    borderLeft: '2px solid var(--xp-blue, #7aa2f7)',
    margin: '2px 0',
  },
  assistantMsg: {
    color: 'var(--xp-text, #c0caf5)',
    margin: '2px 0',
  },
  systemMsg: {
    color: 'var(--xp-text-muted, #565f89)',
    fontSize: 11,
    fontStyle: 'italic' as const,
    margin: '2px 0',
    padding: '4px 12px',
  },
  inputArea: {
    borderTop: '1px solid rgba(var(--xp-border-rgb, 41, 46, 66), 0.5)',
    padding: '8px 10px',
    display: 'flex',
    gap: 6,
  },
  input: {
    flex: 1,
    padding: '7px 10px',
    fontSize: 12,
    borderRadius: 6,
    border: '1px solid rgba(var(--xp-border-rgb, 41, 46, 66), 0.5)',
    backgroundColor: 'rgba(var(--xp-bg-rgb, 26, 27, 38), 0.5)',
    color: 'var(--xp-text, #c0caf5)',
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'none' as const,
  },
  sendBtn: {
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 500 as const,
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: 'rgba(217, 119, 6, 0.85)',
    color: '#fff',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
  context: {
    padding: '4px 12px',
    fontSize: 10,
    color: 'var(--xp-text-muted, #565f89)',
    borderBottom: '1px solid rgba(var(--xp-border-rgb, 41, 46, 66), 0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 12,
    padding: 24,
    textAlign: 'center' as const,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 600 as const,
    color: 'var(--xp-text, #c0caf5)',
  },
  emptyDesc: {
    fontSize: 12,
    color: 'var(--xp-text-muted, #565f89)',
    lineHeight: 1.5,
  },
  suggestion: {
    padding: '6px 12px',
    fontSize: 11,
    borderRadius: 6,
    border: '1px solid rgba(var(--xp-border-rgb, 41, 46, 66), 0.4)',
    backgroundColor: 'rgba(var(--xp-border-rgb, 41, 46, 66), 0.15)',
    cursor: 'pointer',
    color: 'var(--xp-text-muted, #565f89)',
    transition: 'all 0.1s',
    textAlign: 'left' as const,
  },
};

const SUGGESTIONS = [
  'Explain the selected file',
  'Find bugs in this code',
  'Refactor for readability',
  'Add error handling',
  'Write tests for this',
];

const ClaudeCodePanel: React.FC = () => {
  const currentPath = useCurrentPath();
  const selectedFiles = useSelectedFiles();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((role: Message['role'], content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, role, content, timestamp: Date.now() },
    ]);
  }, []);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isLoading) return;

    setInput('');
    addMessage('user', msg);
    setIsLoading(true);

    try {
      const context = selectedFiles.length > 0
        ? selectedFiles.map((f) => f.path).join(', ')
        : currentPath;

      const history = (messages || []).filter((m) => m.role !== 'system').slice(-10);
      const aiMessages = [
        {
          role: 'system',
          content: `You are Claude Code, an AI coding assistant integrated into Xplorer file manager. The user is currently in: ${currentPath}. ${selectedFiles.length > 0 ? `Selected files: ${selectedFiles.map((f) => f.name).join(', ')}` : ''}. Help with coding tasks, file analysis, bug fixes, and refactoring. Be concise.`,
        },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: msg },
      ];

      const fileCtx = selectedFiles.length > 0
        ? { path: selectedFiles[0].path }
        : currentPath ? { path: currentPath } : undefined;
      const response = await api.ai.chat('', aiMessages, fileCtx);
      addMessage('assistant', response);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to get response';
      if (errMsg.includes('Ollama') || errMsg.includes('connection')) {
        addMessage('system', 'Claude Code requires Ollama running locally. Start it with: ollama serve');
      } else {
        addMessage('system', `Error: ${errMsg}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, currentPath, selectedFiles, addMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div style={s.container}>
        <div style={s.header}>
          <div style={s.headerIcon}>C</div>
          <span style={s.headerTitle}>Claude Code</span>
        </div>
        <div style={s.empty}>
          <div style={s.headerIcon}>C</div>
          <div style={s.emptyTitle}>Claude Code</div>
          <div style={s.emptyDesc}>
            Ask Claude to edit files, explain code, fix bugs, and more.
            Select files in the explorer for context.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 260 }}>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                style={s.suggestion}
                onClick={() => handleSend(suggestion)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--xp-border-rgb, 41, 46, 66), 0.3)';
                  e.currentTarget.style.color = 'var(--xp-text, #c0caf5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--xp-border-rgb, 41, 46, 66), 0.15)';
                  e.currentTarget.style.color = 'var(--xp-text-muted, #565f89)';
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
        <div style={s.inputArea}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Claude..."
            rows={1}
            style={s.input}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            style={{ ...s.sendBtn, opacity: !input.trim() ? 0.5 : 1 }}
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.headerIcon}>C</div>
        <span style={s.headerTitle}>Claude Code</span>
        <button
          onClick={() => setMessages([])}
          style={{
            marginLeft: 'auto', padding: '2px 8px', fontSize: 10,
            borderRadius: 4, border: '1px solid rgba(var(--xp-border-rgb), 0.4)',
            backgroundColor: 'transparent', color: 'var(--xp-text-muted)',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>

      {/* Context bar */}
      {(selectedFiles.length > 0 || currentPath) && (
        <div style={s.context}>
          <span style={{ opacity: 0.5 }}>ctx:</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedFiles.length > 0
              ? selectedFiles.map((f) => f.name).join(', ')
              : currentPath?.split(/[/\\]/).pop()}
          </span>
        </div>
      )}

      {/* Messages */}
      <div style={s.messages}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...s.message,
              ...(msg.role === 'user' ? s.userMsg : msg.role === 'assistant' ? s.assistantMsg : s.systemMsg),
            }}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div style={{ ...s.message, ...s.assistantMsg, opacity: 0.5 }}>
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={s.inputArea}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Claude..."
          rows={1}
          style={s.input}
          disabled={isLoading}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          style={{ ...s.sendBtn, opacity: !input.trim() || isLoading ? 0.5 : 1 }}
        >
          {isLoading ? '...' : 'Send'}
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
  permissions: ['file:read', 'ui:panels'],
  render: () => <ClaudeCodePanel />,
  onActivate: (xplorerApi) => {
    api = xplorerApi;
  },
});

Command.register({
  id: 'claude-code.open',
  title: 'Open Claude Code',
  shortcut: 'ctrl+shift+c',
  permissions: ['ui:panels'],
  action: async () => {
    api?.ui.showMessage('Claude Code panel is available in the right sidebar', 'info');
  },
});
