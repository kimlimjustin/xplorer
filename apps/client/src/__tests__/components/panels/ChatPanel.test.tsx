import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { flushSync } from 'react-dom';
import '@testing-library/jest-dom';

// Mock AI and Agent services -- return rejected promises so no state updates trigger
vi.mock('@/lib/ai-service', () => ({
  AIService: {
    getAvailableModels: vi.fn().mockRejectedValue(new Error('mocked')),
    checkOllamaStatus: vi.fn().mockRejectedValue(new Error('mocked')),
    analyzeContextItem: vi.fn().mockResolvedValue({ is_dir: false, content: 'test' }),
    buildAgentContext: vi.fn().mockReturnValue(''),
  },
}));

vi.mock('@/lib/agent-service', () => ({
  AgentService: {
    getSettings: vi.fn().mockRejectedValue(new Error('mocked')),
    updateSettings: vi.fn().mockResolvedValue(undefined),
    startAgentChat: vi.fn().mockResolvedValue(undefined),
    respondToApproval: vi.fn().mockResolvedValue(undefined),
    cancelSession: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/components/ui/MarkdownRenderer', () => ({
  default: ({ content }: { content: string }) => content,
}));

import ChatPanel from '@/components/panels/ChatPanel';
import type { ChatMessage } from '@/lib/ai-service';

const renderChatPanel = (props: Partial<React.ComponentProps<typeof ChatPanel>> = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = ReactDOM.createRoot(container);

  const defaultProps = {
    chatMessages: [] as ChatMessage[],
    chatInput: '',
    setChatInput: vi.fn(),
    isAiLoading: false,
    sendChatMessage: vi.fn(),
    addChatMessage: vi.fn(),
    currentPath: 'C:\\test',
    ...props,
  };

  flushSync(() => {
    root.render(<ChatPanel {...defaultProps} />);
  });

  return {
    container,
    root,
    unmount: () => {
      root.unmount();
      document.body.removeChild(container);
    },
  };
};

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Empty State', () => {
    it('renders without crashing', () => {
      const { container, unmount } = renderChatPanel();
      expect(container.innerHTML).not.toBe('');
      unmount();
    });

    it('shows the panel header', () => {
      const { container, unmount } = renderChatPanel();
      // Agent enabled is the default (true in the component), but our mock returns
      // rejected promise for getSettings, so agentEnabled stays at its initial value (true)
      expect(container.textContent).toContain('Xplorer Agent');
      unmount();
    });
  });

  describe('Message Display', () => {
    it('renders user messages', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'Hello AI', timestamp: 1000 }];
      const { container, unmount } = renderChatPanel({ chatMessages: messages });
      expect(container.textContent).toContain('Hello AI');
      unmount();
    });

    it('renders assistant messages', () => {
      const messages: ChatMessage[] = [
        { role: 'assistant', content: 'I can help with that', timestamp: 2000 },
      ];
      const { container, unmount } = renderChatPanel({ chatMessages: messages });
      expect(container.textContent).toContain('I can help with that');
      unmount();
    });

    it('renders multiple messages in order', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'First message', timestamp: 1000 },
        { role: 'assistant', content: 'First reply', timestamp: 2000 },
        { role: 'user', content: 'Second message', timestamp: 3000 },
      ];
      const { container, unmount } = renderChatPanel({ chatMessages: messages });
      const text = container.textContent || '';
      expect(text).toContain('First message');
      expect(text).toContain('First reply');
      expect(text).toContain('Second message');
      unmount();
    });

    it('applies different styles for user vs assistant messages', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'User msg', timestamp: 1000 },
        { role: 'assistant', content: 'Bot msg', timestamp: 2000 },
      ];
      const { container, unmount } = renderChatPanel({ chatMessages: messages });

      // User messages should have 'justify-end' (right-aligned)
      const userDiv = container.querySelector('.justify-end');
      expect(userDiv).toBeTruthy();
      expect(userDiv?.textContent).toContain('User msg');

      // Assistant messages should have 'justify-start' (left-aligned)
      const assistantDiv = container.querySelector('.justify-start');
      expect(assistantDiv).toBeTruthy();
      expect(assistantDiv?.textContent).toContain('Bot msg');

      unmount();
    });

    it('uses MarkdownRenderer for assistant messages', () => {
      const messages: ChatMessage[] = [
        { role: 'assistant', content: 'Markdown **content**', timestamp: 1000 },
      ];
      const { container, unmount } = renderChatPanel({ chatMessages: messages });
      // Our mock MarkdownRenderer just returns the content string
      expect(container.textContent).toContain('Markdown **content**');
      unmount();
    });
  });

  describe('Input Area', () => {
    it('renders the textarea', () => {
      const { container, unmount } = renderChatPanel();
      const textarea = container.querySelector('textarea');
      expect(textarea).toBeTruthy();
      unmount();
    });

    it('shows the current input value', () => {
      const { container, unmount } = renderChatPanel({ chatInput: 'test query' });
      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea?.value).toBe('test query');
      unmount();
    });
  });

  describe('Header', () => {
    it('displays model info', () => {
      const { container, unmount } = renderChatPanel();
      // Settings are minimized by default; compact mode shows model name
      expect(container.textContent).toContain('Model:');
      unmount();
    });

    it('shows status indicator dot', () => {
      const { container, unmount } = renderChatPanel();
      const statusDot = container.querySelector('.rounded-full');
      expect(statusDot).toBeTruthy();
      unmount();
    });

    it('shows settings toggle button', () => {
      const { container, unmount } = renderChatPanel();
      // The settings button has a gear emoji or chevron
      const settingsBtn = container.querySelector('button[title]');
      expect(settingsBtn).toBeTruthy();
      unmount();
    });
  });

  describe('Context Files', () => {
    it('shows add context button', () => {
      const { container, unmount } = renderChatPanel();
      expect(container.textContent).toContain('Add context files');
      unmount();
    });
  });
});
