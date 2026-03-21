import { useState, useCallback, useEffect, useRef } from 'react';
import { transport } from '@/lib/transport';
import { AIService, type ChatMessage, type FileContext } from '@/lib/ai-service';
import { AgentService, type AgentEvent } from '@/lib/agent-service';
import { useChatState } from '@/hooks/use-chat-state';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatFileContext {
  path: string;
  name: string;
}

export interface ChatFileMessage {
  role: string;
  content: string;
  timestamp: number;
  model?: string;
  thinking?: string;
}

export interface ChatFileData {
  version: number;
  model: string;
  thinking_enabled: boolean;
  context: ChatFileContext[];
  messages: ChatFileMessage[];
}

export interface UseChatFileOptions {
  filePath: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTO_SAVE_DELAY = 500;

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useChatFile = ({ filePath }: UseChatFileOptions) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Refs for debounced auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;

  // Reuse the shared chat UI state (tool calls, approvals, streaming, etc.)
  const chatState = useChatState();
  const { state } = chatState;

  // ── Load file on mount / filePath change ──────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const data = await transport<ChatFileData | null>('read_chat_file', { path: filePath });
        if (cancelled) return;

        if (data && data.messages && data.messages.length > 0) {
          const loaded: ChatMessage[] = data.messages.map((m) => ({
            role: m.role as ChatMessage['role'],
            content: m.content,
            timestamp: m.timestamp,
            model: m.model,
            thinking: m.thinking,
          }));
          setMessages(loaded);
        } else {
          setMessages([]);
        }

        if (data) {
          if (data.model) chatState.setSelectedModel(data.model);
          if (data.thinking_enabled !== undefined) {
            chatState.setThinkingEnabled(data.thinking_enabled);
          }
          if (data.context && data.context.length > 0) {
            chatState.setContextFiles(
              data.context.map((c) => ({ path: c.path, name: c.name, file_type: '' })),
            );
          }
        }
      } catch {
        // File doesn't exist yet or read failed — start empty
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    // Load available models
    AIService.getAvailableModels()
      .then((models) => {
        if (!cancelled) chatState.setAvailableModels(models);
      })
      .catch(() => {});

    AIService.checkOllamaStatus()
      .then((status) => {
        if (!cancelled) chatState.setOllamaStatus(status);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

  // ── Auto-save on message / settings changes ──────────────────────────────

  const saveToFile = useCallback(async () => {
    const msgs = messagesRef.current;
    const fp = filePathRef.current;

    const data: ChatFileData = {
      version: 1,
      model: state.selectedModel,
      thinking_enabled: state.thinkingEnabled,
      context: state.contextFiles.map((f) => ({ path: f.path, name: f.name })),
      messages: msgs.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp || 0,
        model: m.model,
        thinking: m.thinking,
      })),
    };

    try {
      await transport('save_chat_file', { path: fp, data });
    } catch {
      // Auto-save is best-effort
    }
  }, [state.selectedModel, state.thinkingEnabled, state.contextFiles]);

  // Debounced save whenever messages change
  useEffect(() => {
    if (isLoading) return; // Don't save while loading initial data
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToFile();
    }, AUTO_SAVE_DELAY);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    messages,
    state.selectedModel,
    state.thinkingEnabled,
    state.contextFiles,
    saveToFile,
    isLoading,
  ]);

  // ── Add a message ────────────────────────────────────────────────────────

  // ── Send message (agent mode) ────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const userText = chatInput.trim();
    if (!userText || state.isAgentRunning) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    chatState.agentSendStart();

    // Build conversation history for the API
    const conversationMessages = [...messagesRef.current, userMsg].map((m) => ({
      role: m.role as string,
      content: m.content,
    }));

    let accumulatedText = '';
    let accumulatedThinking = '';

    // Build filesystem context from context files
    const contextParts: string[] = [];
    if (state.contextFiles.length > 0) {
      contextParts.push('Context files:');
      for (const f of state.contextFiles) {
        contextParts.push(`- ${f.name} (${f.path})`);
      }
    }
    const filesystemContext = contextParts.length > 0 ? contextParts.join('\n') : undefined;

    try {
      await AgentService.startAgentChat(
        conversationMessages,
        '',
        (event: AgentEvent) => {
          switch (event.event_type) {
            case 'thinking_delta':
              if (event.text) {
                accumulatedThinking += event.text;
                chatState.setStreamingThinking(accumulatedThinking);
              }
              break;

            case 'text':
            case 'text_delta':
              if (event.text) {
                accumulatedText += event.text;
                chatState.setStreamingText(accumulatedText);
              }
              break;

            case 'tool_call':
              if (event.tool_call) {
                const tc = event.tool_call;
                chatState.upsertToolCall({
                  id: tc.id,
                  name: tc.name,
                  input: tc.input as Record<string, unknown>,
                  requires_approval: tc.requires_approval,
                  status: tc.status,
                  result: tc.result,
                  error: tc.error,
                  expanded: false,
                });
              }
              break;

            case 'approval_request':
              if (event.tool_call) {
                chatState.addPendingApproval(event.tool_call);
              }
              break;

            case 'tool_result':
              if (event.tool_call) {
                const tc = event.tool_call;
                chatState.removePendingApproval(tc.id);
                chatState.updateToolCall(tc.id, {
                  status: tc.status,
                  result: tc.result,
                  error: tc.error,
                });
              }
              break;

            case 'plan_created':
              if (event.plan) {
                chatState.setActivePlan(event.plan);
              }
              break;

            case 'complete':
              if (accumulatedText) {
                const assistantMsg: ChatMessage = {
                  role: 'assistant',
                  content: accumulatedText,
                  timestamp: Date.now(),
                  model: state.selectedModel,
                  thinking: accumulatedThinking || undefined,
                };
                setMessages((prev) => [...prev, assistantMsg]);
              }
              chatState.agentSendComplete();
              break;

            case 'error':
              setMessages((prev) => [
                ...prev,
                {
                  role: 'assistant' as const,
                  content: `Error: ${event.text || 'Unknown error occurred'}`,
                  timestamp: Date.now(),
                },
              ]);
              chatState.agentSendError();
              break;
          }
        },
        filesystemContext,
        state.selectedModel,
      );
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant' as const,
          content: `Agent error: ${error}`,
          timestamp: Date.now(),
        },
      ]);
      chatState.setIsAgentRunning(false);
    }
  }, [chatInput, state.isAgentRunning, state.contextFiles, state.selectedModel, chatState]);

  // ── Context file helpers ─────────────────────────────────────────────────

  const addContextFile = useCallback(
    (file: ChatFileContext) => {
      chatState.addContextFile({ path: file.path, name: file.name, file_type: '' });
    },
    [chatState],
  );

  const removeContextFile = useCallback(
    (path: string) => {
      chatState.removeContextFile(path);
    },
    [chatState],
  );

  // ── Model / thinking setters ─────────────────────────────────────────────

  const setModel = useCallback(
    (model: string) => {
      chatState.setSelectedModel(model);
    },
    [chatState],
  );

  const setThinkingEnabled = useCallback(
    (enabled: boolean) => {
      chatState.setThinkingEnabled(enabled);
    },
    [chatState],
  );

  // ── Cancel ───────────────────────────────────────────────────────────────

  const handleCancel = useCallback(async () => {
    try {
      await AgentService.cancelSession();
      chatState.setIsAgentRunning(false);
      chatState.setStreamingText('');
      chatState.setStreamingThinking('');
    } catch (error) {
      console.error('Failed to cancel session:', error);
    }
  }, [chatState]);

  // ── Approval ─────────────────────────────────────────────────────────────

  const handleApproval = useCallback(
    async (toolCallId: string, response: string) => {
      try {
        await AgentService.respondToApproval(toolCallId, response);
        chatState.removePendingApproval(toolCallId);
        chatState.updateToolCall(toolCallId, {
          status: response.startsWith('allow') ? 'running' : 'denied',
        });
      } catch (error) {
        console.error('Failed to respond to approval:', error);
      }
    },
    [chatState],
  );

  return {
    // Messages
    messages,
    isLoading,

    // Input
    chatInput,
    setChatInput,

    // Actions
    sendMessage,
    handleCancel,
    handleApproval,

    // Model
    model: state.selectedModel,
    setModel,
    availableModels: state.availableModels,

    // Thinking
    thinkingEnabled: state.thinkingEnabled,
    setThinkingEnabled,

    // Context
    contextFiles: state.contextFiles as Array<FileContext & ChatFileContext>,
    addContextFile,
    removeContextFile,

    // Agent state
    isAgentRunning: state.isAgentRunning,

    // UI state (from useChatState)
    toolCalls: state.toolCalls,
    pendingApprovals: state.pendingApprovals,
    streamingText: state.streamingText,
    streamingThinking: state.streamingThinking,
    activePlan: state.activePlan,
    toggleToolCallExpand: chatState.toggleToolCallExpand,
  };
};
