import React from 'react';

interface ChatInputProps {
  chatInput: string;
  setChatInput: (input: string) => void;
  isAiLoading: boolean;
  isAgentRunning: boolean;
  agentEnabled: boolean;
  onSendMessage: () => void;
  onCancel: () => void;
}

const ChatInput = ({
  chatInput,
  setChatInput,
  isAiLoading,
  isAgentRunning,
  agentEnabled,
  onSendMessage,
  onCancel,
}: ChatInputProps) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className="px-3 py-2.5 border-t border-xp-border flex-shrink-0">
      <div className="flex gap-2">
        <textarea
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={
            agentEnabled ? 'Ask the agent to manage your files...' : 'Ask about your files...'
          }
          className="flex-1 px-3 py-2 bg-xp-bg border border-xp-border rounded text-sm outline-none focus:ring-1 focus:ring-xp-blue resize-none"
          disabled={isAiLoading || isAgentRunning}
          rows={1}
          aria-label={agentEnabled ? 'Ask the agent to manage your files' : 'Ask about your files'}
        />
        {isAgentRunning ? (
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-xp-red text-white rounded hover:opacity-80 flex items-center justify-center text-xs font-medium transition-colors"
            aria-label="Stop agent"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={onSendMessage}
            disabled={!chatInput.trim() || isAiLoading}
            className="px-4 py-2 bg-xp-blue text-white rounded hover:bg-opacity-80 disabled:opacity-50 flex items-center justify-center transition-colors"
            aria-label="Send message"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex items-center justify-center mt-1 text-xs text-xp-text-muted">
        <span>Enter to send{agentEnabled ? ' \u2022 Agent mode' : ''}</span>
      </div>
    </div>
  );
}

export default ChatInput;
