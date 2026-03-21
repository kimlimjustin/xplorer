import { useEffect, useRef, useMemo } from 'react';
import { useChatFile } from '@/hooks/use-chat-file';
import {
  MessageBubble,
  ToolCallsList,
  ActivePlanDisplay,
  PendingApprovalCard,
  StreamingMessage,
  EmptyState,
} from '@/components/panels/ChatMessage';
import ChatInput from '@/components/panels/ChatInput';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ChatFileViewProps {
  filePath: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive a human-readable title from a .chat file path. */
const deriveTitleFromPath = (filePath: string): string => {
  // Extract filename from path (handle both / and \)
  const segments = filePath.split(/[/\\]/);
  let name = segments[segments.length - 1] || 'Chat';

  // Remove .chat extension
  if (name.toLowerCase().endsWith('.chat')) {
    name = name.slice(0, -5);
  }

  // Remove date prefix if it starts with YYYY-MM-DD_
  name = name.replace(/^\d{4}-\d{2}-\d{2}_/, '');

  // Replace hyphens and underscores with spaces
  name = name.replace(/[-_]/g, ' ');

  // Capitalize first letter of each word
  name = name.replace(/\b\w/g, (c) => c.toUpperCase());

  return name || 'Chat';
};

// ── Model list ────────────────────────────────────────────────────────────────

const BUILT_IN_MODELS = [
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'gpt-4.1', name: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
  { id: 'o3-mini', name: 'o3-mini' },
];

// ── Component ─────────────────────────────────────────────────────────────────

const ChatFileView = ({ filePath }: ChatFileViewProps) => {
  const {
    messages,
    isLoading,
    chatInput,
    setChatInput,
    sendMessage,
    handleCancel,
    handleApproval,
    model,
    setModel,
    availableModels,
    thinkingEnabled,
    setThinkingEnabled,
    contextFiles,
    removeContextFile,
    isAgentRunning,
    toolCalls,
    pendingApprovals,
    streamingText,
    streamingThinking,
    activePlan,
    toggleToolCallExpand,
  } = useChatFile({ filePath });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const title = useMemo(() => deriveTitleFromPath(filePath), [filePath]);

  // Build merged model list: built-in + Ollama models that aren't duplicates
  const allModels = useMemo(() => {
    const ollamaModels = availableModels
      .filter(
        (m) => !m.id.startsWith('claude-') && !m.id.startsWith('gpt-') && !m.id.startsWith('o3'),
      )
      .map((m) => ({ id: m.id, name: m.name }));
    return [...BUILT_IN_MODELS, ...ollamaModels];
  }, [availableModels]);

  // Auto-scroll to bottom on new messages / streaming
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, toolCalls, streamingText]);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="bg-xp-bg flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="border-xp-blue h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          <span className="text-xp-text-muted text-sm">Loading chat...</span>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-xp-bg flex h-full flex-col" role="region" aria-label="Chat file view">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-xp-border bg-xp-surface flex-shrink-0 border-b px-4 py-3">
        <div className="mx-auto max-w-3xl">
          {/* Top row: title + model + thinking */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Title */}
            <h2 className="text-xp-text mr-auto truncate text-base font-semibold">{title}</h2>

            {/* Model selector */}
            <div className="relative">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-xp-bg border-xp-border hover:bg-xp-bg-hover focus:ring-xp-blue cursor-pointer appearance-none rounded border px-3 py-1.5 pr-7 text-xs transition-colors focus:outline-none focus:ring-1"
                aria-label="Select AI model"
              >
                {allModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <svg
                className="text-xp-text-muted pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            {/* Thinking toggle */}
            <button
              onClick={() => setThinkingEnabled(!thinkingEnabled)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                thinkingEnabled
                  ? 'bg-xp-cyan text-white hover:opacity-80'
                  : 'bg-xp-border text-xp-text hover:bg-xp-surface-light'
              }`}
              aria-label={`Thinking mode: ${thinkingEnabled ? 'enabled' : 'disabled'}`}
              aria-pressed={thinkingEnabled}
            >
              {thinkingEnabled ? 'Thinking ON' : 'Thinking OFF'}
            </button>
          </div>

          {/* Context chips */}
          {contextFiles.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xp-text-muted text-xs">Context:</span>
              {contextFiles.map((file) => (
                <span
                  key={file.path}
                  className="bg-xp-blue/10 border-xp-blue/20 text-xp-text inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                >
                  <span className="max-w-[150px] truncate">{file.name}</span>
                  <button
                    onClick={() => removeContextFile(file.path)}
                    className="text-xp-text-muted hover:text-xp-text flex-shrink-0 transition-colors"
                    aria-label={`Remove ${file.name} from context`}
                  >
                    {'\u00D7'}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Messages area ──────────────────────────────────────────────────── */}
      <div
        ref={messagesContainerRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-6"
        aria-live="polite"
        aria-label="Chat messages"
        role="log"
      >
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 && !isAgentRunning ? (
            <EmptyState agentEnabled={true} />
          ) : (
            messages.map((message, idx) => (
              <MessageBubble
                key={`${message.role}-${message.timestamp || idx}`}
                message={message}
              />
            ))
          )}

          {/* Tool Calls Display */}
          <ToolCallsList toolCalls={toolCalls} onToggleExpand={toggleToolCallExpand} />

          {/* Active Plan Display */}
          {activePlan && <ActivePlanDisplay plan={activePlan} />}

          {/* Pending Approval Dialogs */}
          {pendingApprovals.map((tc) => (
            <PendingApprovalCard
              key={tc.id}
              toolCall={tc}
              activePlan={activePlan}
              onApproval={handleApproval}
            />
          ))}

          {/* Streaming Thinking (collapsible) */}
          {streamingThinking && (
            <div className="flex justify-start">
              <details
                open
                className="bg-xp-bg border-xp-border min-w-0 max-w-[85%] overflow-hidden rounded-lg border"
              >
                <summary className="text-xp-text-muted hover:bg-xp-bg-hover flex cursor-pointer select-none items-center gap-1.5 px-3 py-1.5 text-xs">
                  <div className="bg-xp-cyan h-1.5 w-1.5 animate-pulse rounded-full" />
                  <span>Thinking...</span>
                </summary>
                <div className="text-xp-text-muted border-xp-border max-h-48 overflow-y-auto whitespace-pre-wrap border-t px-3 py-2 text-xs">
                  {streamingThinking}
                </div>
              </details>
            </div>
          )}

          {/* Streaming Text */}
          <StreamingMessage text={streamingText} />

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />

          {/* Screen reader status announcements */}
          <div className="sr-only" aria-live="assertive">
            {isAgentRunning && 'Agent is processing your request'}
          </div>
        </div>
      </div>

      {/* ── Input area ─────────────────────────────────────────────────────── */}
      <div className="border-xp-border bg-xp-surface flex-shrink-0 border-t">
        <div className="mx-auto max-w-3xl">
          <ChatInput
            chatInput={chatInput}
            setChatInput={setChatInput}
            isAiLoading={false}
            isAgentRunning={isAgentRunning}
            agentEnabled={true}
            onSendMessage={sendMessage}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatFileView;
