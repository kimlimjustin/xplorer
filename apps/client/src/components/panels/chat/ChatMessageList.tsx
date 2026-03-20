import { useRef, useEffect } from 'react';
import type { ChatMessage } from '@/lib/ai-service';
import type { ChatState } from '@/hooks/use-chat-state';
// OperationPlan type removed — not used directly in this file
import {
  MessageBubble,
  ActivePlanDisplay,
  PendingApprovalCard,
  LoadingIndicator,
  EmptyState,
  AgentStreamView,
  StreamingMessage,
} from '@/components/panels/ChatMessage';

interface ChatMessageListProps {
  chatMessages: ChatMessage[];
  state: ChatState;
  isAiLoading: boolean;
  toggleToolCallExpand: (id: string) => void;
  handleApproval: (toolCallId: string, response: string) => Promise<void>;
}

const ChatMessageList = ({
  chatMessages,
  state,
  isAiLoading,
  toggleToolCallExpand,
  handleApproval,
}: ChatMessageListProps) => {
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change -- use scrollTop instead of
  // scrollIntoView to avoid scrolling ancestor containers (causes page overflow)
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages, state.toolCalls, state.streamingText, state.streamItems]);

  return (
    <div
      ref={messagesContainerRef}
      style={{ flex: '1 1 0%', minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'hidden' }}
      className="px-3 py-3 space-y-3"
      aria-live="polite"
      aria-label="Chat messages"
      role="log"
    >
      {chatMessages.length === 0 && !state.isAgentRunning ? (
        <EmptyState agentEnabled={state.agentEnabled} />
      ) : (
        chatMessages.map((message) => (
          <MessageBubble key={`${message.role}-${message.timestamp}`} message={message} />
        ))
      )}

      {/* Interleaved agent stream (tool calls + text) */}
      {state.isAgentRunning && state.streamItems.length > 0 && (
        <AgentStreamView
          streamItems={state.streamItems}
          toolCalls={state.toolCalls}
          onToggleExpand={toggleToolCallExpand}
          isStreaming={state.isAgentRunning}
        />
      )}

      {/* Active Plan Display */}
      {state.activePlan && <ActivePlanDisplay plan={state.activePlan} />}

      {/* Pending Approval Dialogs */}
      {state.pendingApprovals.map((tc) => (
        <PendingApprovalCard
          key={tc.id}
          toolCall={tc}
          activePlan={state.activePlan}
          onApproval={handleApproval}
        />
      ))}

      {/* Streaming Thinking (collapsible) */}
      {state.streamingThinking && (
        <div className="flex justify-start">
          <details
            open
            className="max-w-[85%] min-w-0 rounded-lg overflow-hidden bg-xp-bg border border-xp-border"
          >
            <summary className="px-3 py-1.5 text-xs text-xp-text-muted cursor-pointer hover:bg-xp-bg-hover select-none flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-xp-cyan rounded-full animate-pulse" />
              <span>Thinking...</span>
            </summary>
            <div className="px-3 py-2 text-xs text-xp-text-muted border-t border-xp-border whitespace-pre-wrap max-h-48 overflow-y-auto">
              {state.streamingThinking}
            </div>
          </details>
        </div>
      )}

      {/* Streaming Text (fallback for non-agent chat) */}
      {!state.isAgentRunning && <StreamingMessage text={state.streamingText} />}

      {/* Loading indicator (non-agent) */}
      {isAiLoading && !state.isAgentRunning && <LoadingIndicator />}

      {/* Screen reader status announcements */}
      <div className="sr-only" aria-live="assertive">
        {state.isAgentRunning && 'Agent is processing your request'}
        {isAiLoading && !state.isAgentRunning && 'AI is generating a response'}
      </div>
    </div>
  );
}

export default ChatMessageList;
