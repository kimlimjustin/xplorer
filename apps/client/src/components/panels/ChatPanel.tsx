import { useState, useEffect, useRef, useMemo } from 'react';
import { FolderOpen, FolderClosed, FileText } from 'lucide-react';
import { AIService, type ChatMessage, type FileContext } from '@/lib/ai-service';
import { AgentService, type AgentEvent } from '@/lib/agent-service';
import { useChatState } from '@/hooks/use-chat-state';
import {
  MessageBubble,
  ToolCallsList,
  ActivePlanDisplay,
  PendingApprovalCard,
  StreamingMessage,
  LoadingIndicator,
  EmptyState,
} from '@/components/panels/ChatMessage';
import ChatInput from '@/components/panels/ChatInput';

interface ChatSessionSummaryItem {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

interface ChatPanelProps {
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (input: string) => void;
  isAiLoading: boolean;
  sendChatMessage: (model: string, fileContext?: FileContext) => void;
  addChatMessage: (message: ChatMessage) => void;
  selectedFile?: FileContext;
  allFiles?: Array<{ name: string; path: string; file_type: string; is_dir: boolean }>;
  selectedFilePaths?: Set<string>;
  currentPath: string;
  // Session history
  sessions?: ChatSessionSummaryItem[];
  currentSessionId?: string | null;
  onNewSession?: () => void;
  onLoadSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onClearHistory?: () => void;
}

const ChatPanel = ({
  chatMessages,
  chatInput,
  setChatInput,
  isAiLoading,
  sendChatMessage,
  addChatMessage,
  selectedFile,
  allFiles = [],
  selectedFilePaths,
  currentPath,
  sessions = [],
  currentSessionId,
  onNewSession,
  onLoadSession,
  onDeleteSession,
  onClearHistory,
}: ChatPanelProps) => {
  const {
    state,
    setAvailableModels,
    setSelectedModel,
    setOllamaStatus,
    setIsModelDropdownOpen: _setIsModelDropdownOpen,
    setIsContextDropdownOpen,
    setIsSettingsMinimized,
    setContextSearchQuery,
    setContextFiles,
    addContextFile: dispatchAddContextFile,
    removeContextFile,
    setIncludeCurrentFolder,
    setAgentEnabled,
    setAutoApprove,
    setThinkingEnabled,
    setIsAgentRunning,
    setStreamingText,
    setStreamingThinking,
    setActivePlan,
    toggleToolCallExpand,
    upsertToolCall,
    updateToolCall,
    addPendingApproval,
    removePendingApproval,
    closeAllDropdowns,
    agentSendStart,
    agentSendComplete,
    agentSendError,
    resetContext,
  } = useChatState();

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!state.isModelDropdownOpen && !state.isContextDropdownOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (chatPanelRef.current && !chatPanelRef.current.contains(e.target as Node)) {
        closeAllDropdowns();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [state.isModelDropdownOpen, state.isContextDropdownOpen, closeAllDropdowns]);

  const contextableFiles = useMemo(
    () => allFiles.filter((file) => !file.name.startsWith('.')),
    [allFiles],
  );
  const filteredContextFiles = useMemo(
    () =>
      contextableFiles.filter(
        (file) =>
          file.name.toLowerCase().includes(state.contextSearchQuery.toLowerCase()) ||
          file.path.toLowerCase().includes(state.contextSearchQuery.toLowerCase()),
      ),
    [contextableFiles, state.contextSearchQuery],
  );

  // Re-include current folder when path changes
  useEffect(() => {
    setIncludeCurrentFolder(true);
  }, [currentPath, setIncludeCurrentFolder]);

  // Load models and agent settings on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        const models = await AIService.getAvailableModels();
        setAvailableModels(models);
        const status = await AIService.checkOllamaStatus();
        setOllamaStatus(status);
      } catch (error) {
        console.error('Failed to load AI models:', error);
      }
    };

    const loadAgentSettings = async () => {
      try {
        const settings = await AgentService.getSettings();
        setAgentEnabled(settings.enabled);
        setAutoApprove(settings.auto_approve);
        setThinkingEnabled(settings.thinking_enabled);
        if (settings.model) {
          setSelectedModel(settings.model);
        }
      } catch (e) {
        console.warn('Agent settings not available yet, using defaults:', e);
      }
    };

    loadModels();
    loadAgentSettings();
  }, [
    setAvailableModels,
    setOllamaStatus,
    setAgentEnabled,
    setAutoApprove,
    setThinkingEnabled,
    setSelectedModel,
  ]);

  // Auto-scroll to bottom when messages change — use scrollTop instead of
  // scrollIntoView to avoid scrolling ancestor containers (causes page overflow)
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages, state.toolCalls, state.streamingText]);

  // Auto-sync selected files as context
  useEffect(() => {
    if (!selectedFilePaths || selectedFilePaths.size === 0) {
      setContextFiles([]);
      return;
    }
    const selected = allFiles.filter((f) => selectedFilePaths.has(f.path));
    setContextFiles(
      selected.map((f) => ({
        name: f.name,
        path: f.path,
        file_type: f.file_type,
        content: undefined,
      })),
    );
  }, [selectedFilePaths, allFiles, setContextFiles]);

  const handleSendMessage = async (overrideText?: string) => {
    const text = overrideText ?? chatInput.trim();
    if (!text || isAiLoading || state.isAgentRunning) return;

    if (state.agentEnabled) {
      await handleAgentSend(text);
    } else {
      // If using overrideText, set it as chatInput so sendChatMessage picks it up
      if (overrideText) {
        setChatInput(overrideText);
      }
      // Fallback to simple chat mode
      let combinedContext = selectedFile;
      if (state.contextFiles.length > 0) {
        const contextContents = await Promise.all(
          state.contextFiles.map(async (file) => {
            try {
              const contextNode = await AIService.analyzeContextItem(file.path, 1);
              if (contextNode.is_dir) {
                return `// Directory: ${file.name}\n// Path: ${file.path}\n// Structure:\n${AIService.buildAgentContext(contextNode)}`;
              }
              return `// File: ${file.name}\n// Path: ${file.path}\n${contextNode.content || 'Content not available'}`;
            } catch (error) {
              return `// Error loading ${file.name}: ${error}`;
            }
          }),
        );
        combinedContext = {
          ...selectedFile,
          name:
            state.contextFiles.length === 1
              ? state.contextFiles[0].name
              : `${state.contextFiles.length} items`,
          path: state.contextFiles.length === 1 ? state.contextFiles[0].path : 'Multiple items',
          file_type: 'multiple',
          content: contextContents.join('\n\n---\n\n'),
        };
      }
      sendChatMessage(state.selectedModel, combinedContext);
    }
  };

  const handleAgentSend = async (text?: string) => {
    const userText = text ?? chatInput.trim();
    if (!userText) return;

    const fullMessage = userText;

    // Add user message (show the original text in the UI, not the context prefix)
    const userMsg: ChatMessage = {
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };
    addChatMessage(userMsg);
    setChatInput('');

    agentSendStart();

    // Build conversation history for the API — use full message with context for the latest message
    const conversationMessages = [
      ...chatMessages.map((m) => ({
        role: m.role as string,
        content: m.content,
      })),
      { role: 'user', content: fullMessage },
    ];

    let accumulatedText = '';
    let accumulatedThinking = '';

    // Build filesystem context from selected files
    const contextParts: string[] = [];
    if (state.contextFiles.length > 0) {
      contextParts.push('Selected files:');
      for (const f of state.contextFiles) {
        contextParts.push(`- ${f.name} (${f.path})`);
      }
    }
    const filesystemContext = contextParts.length > 0 ? contextParts.join('\n') : undefined;

    try {
      await AgentService.startAgentChat(
        conversationMessages,
        state.includeCurrentFolder ? currentPath : '',
        (event: AgentEvent) => {
          switch (event.event_type) {
            case 'thinking_delta':
              if (event.text) {
                accumulatedThinking += event.text;
                setStreamingThinking(accumulatedThinking);
              }
              break;

            case 'text':
            case 'text_delta':
              if (event.text) {
                accumulatedText += event.text;
                setStreamingText(accumulatedText);
              }
              break;

            case 'tool_call':
              if (event.tool_call) {
                const tc = event.tool_call;
                upsertToolCall({
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
                addPendingApproval(event.tool_call);
              }
              break;

            case 'tool_result':
              if (event.tool_call) {
                const tc = event.tool_call;
                removePendingApproval(tc.id);
                updateToolCall(tc.id, { status: tc.status, result: tc.result, error: tc.error });
              }
              break;

            case 'plan_created':
              if (event.plan) {
                setActivePlan(event.plan);
              }
              break;

            case 'complete':
              // Finalize assistant message
              if (accumulatedText) {
                addChatMessage({
                  role: 'assistant',
                  content: accumulatedText,
                  timestamp: Date.now(),
                  model: state.selectedModel,
                  thinking: accumulatedThinking || undefined,
                });
              }
              agentSendComplete();
              break;

            case 'error':
              addChatMessage({
                role: 'assistant',
                content: `Error: ${event.text || 'Unknown error occurred'}`,
                timestamp: Date.now(),
              });
              agentSendError();
              break;
          }
        },
        filesystemContext,
        state.selectedModel,
      );
    } catch (error) {
      addChatMessage({
        role: 'assistant',
        content: `Agent error: ${error}`,
        timestamp: Date.now(),
      });
      setIsAgentRunning(false);
    }
  };

  const handleApproval = async (toolCallId: string, response: string) => {
    try {
      await AgentService.respondToApproval(toolCallId, response);
      removePendingApproval(toolCallId);
      updateToolCall(toolCallId, { status: response.startsWith('allow') ? 'running' : 'denied' });
    } catch (error) {
      console.error('Failed to respond to approval:', error);
    }
  };

  const handleCancel = async () => {
    try {
      await AgentService.cancelSession();
      setIsAgentRunning(false);
      setStreamingText('');
    } catch (error) {
      console.error('Failed to cancel session:', error);
    }
  };

  const addContextFileFromList = (file: {
    name: string;
    path: string;
    file_type: string;
    is_dir: boolean;
  }) => {
    dispatchAddContextFile({
      name: file.name,
      path: file.path,
      file_type: file.file_type,
      content: undefined,
    });
    setIsContextDropdownOpen(false);
    setContextSearchQuery('');
  };

  const formatSessionDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div
      ref={chatPanelRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0%',
        minHeight: 0,
        overflow: 'hidden',
      }}
      role="region"
      aria-label={state.agentEnabled ? 'Xplorer Agent chat' : 'Copilot Assistant chat'}
    >
      {/* Header */}
      <div className="border-xp-border flex-shrink-0 border-b px-3 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-medium">
            {state.agentEnabled ? 'Xplorer Agent' : 'Copilot Assistant'}
          </h3>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {onNewSession && (
              <button
                onClick={() => {
                  onNewSession();
                  setShowHistory(false);
                }}
                className="hover:bg-xp-surface-light rounded p-1 text-xs transition-colors"
                title="New chat"
                aria-label="Start new chat session"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            )}
            {sessions.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`rounded p-1 text-xs transition-colors ${showHistory ? 'bg-xp-blue text-white' : 'hover:bg-xp-surface-light'}`}
                title="Chat history"
                aria-label="Toggle chat history"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            )}
            <button
              onClick={() => setIsSettingsMinimized(!state.isSettingsMinimized)}
              className="hover:bg-xp-surface-light rounded p-1 text-xs transition-colors"
              title={state.isSettingsMinimized ? 'Expand settings' : 'Minimize settings'}
              aria-label={
                state.isSettingsMinimized ? 'Expand chat settings' : 'Minimize chat settings'
              }
              aria-expanded={!state.isSettingsMinimized}
            >
              {state.isSettingsMinimized ? '\u2699\uFE0F' : '\u25BC'}
            </button>
            {(() => {
              let dotClass = 'bg-xp-red';
              if (state.agentEnabled) dotClass = 'bg-xp-purple';
              else if (state.ollamaStatus) dotClass = 'bg-xp-green';
              return <div className={`h-2 w-2 flex-shrink-0 rounded-full ${dotClass}`} />;
            })()}
            <span className="text-xp-text-muted whitespace-nowrap text-xs">
              {(() => {
                if (state.agentEnabled) return 'Agent Mode';
                if (state.ollamaStatus) return 'AI Connected';
                return 'Limited AI';
              })()}
            </span>
          </div>
        </div>

        {/* Expanded Settings */}
        {!state.isSettingsMinimized && (
          <div className="space-y-3">
            {/* Model Display (configured in Settings > AI) */}
            <div className="bg-xp-bg border-xp-border flex items-center justify-between rounded border px-3 py-2 text-xs">
              <span className="text-xp-text-muted">Model:</span>
              <span className="truncate">{state.selectedModel}</span>
            </div>
            <p className="text-xp-text-muted text-[10px]">Change model in Settings &gt; AI</p>

            {/* Agent Mode Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xp-text-muted text-xs">Agent Mode:</span>
              <button
                onClick={() => setAgentEnabled(!state.agentEnabled)}
                className={`rounded px-3 py-1 text-xs transition-colors ${
                  state.agentEnabled
                    ? 'bg-xp-purple text-white hover:opacity-80'
                    : 'bg-xp-border text-xp-text hover:bg-xp-surface-light'
                }`}
                aria-label={`Agent mode: ${state.agentEnabled ? 'enabled' : 'disabled'}`}
                aria-pressed={state.agentEnabled}
              >
                {state.agentEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Auto-Approve Toggle */}
            {state.agentEnabled && (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xp-text-muted text-xs">Auto-Approve</span>
                  <p className="text-xp-text-muted truncate text-[10px]">
                    {state.autoApprove
                      ? 'All actions run automatically'
                      : 'Asks before writes/deletes'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const next = !state.autoApprove;
                    setAutoApprove(next);
                    AgentService.getSettings()
                      .then((s) => {
                        AgentService.updateSettings({ ...s, auto_approve: next });
                      })
                      .catch((err) => {
                        console.warn('Failed to persist auto-approve setting:', err);
                      });
                  }}
                  className={`rounded px-3 py-1 text-xs transition-colors ${
                    state.autoApprove
                      ? 'bg-xp-orange text-white hover:opacity-80'
                      : 'bg-xp-border text-xp-text hover:bg-xp-surface-light'
                  }`}
                  aria-label={`Auto-approve: ${state.autoApprove ? 'enabled' : 'disabled'}`}
                  aria-pressed={state.autoApprove}
                >
                  {state.autoApprove ? 'ON' : 'OFF'}
                </button>
              </div>
            )}

            {/* Thinking Mode Toggle */}
            {state.agentEnabled && (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xp-text-muted text-xs">Thinking</span>
                  <p className="text-xp-text-muted truncate text-[10px]">
                    {state.thinkingEnabled ? 'Extended reasoning enabled' : 'Standard responses'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const next = !state.thinkingEnabled;
                    setThinkingEnabled(next);
                    AgentService.getSettings()
                      .then((s) => {
                        AgentService.updateSettings({ ...s, thinking_enabled: next });
                      })
                      .catch((err) => {
                        console.warn('Failed to persist thinking setting:', err);
                      });
                  }}
                  className={`rounded px-3 py-1 text-xs transition-colors ${
                    state.thinkingEnabled
                      ? 'bg-xp-cyan text-white hover:opacity-80'
                      : 'bg-xp-border text-xp-text hover:bg-xp-surface-light'
                  }`}
                  aria-label={`Thinking mode: ${state.thinkingEnabled ? 'enabled' : 'disabled'}`}
                  aria-pressed={state.thinkingEnabled}
                >
                  {state.thinkingEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Compact mode info */}
        {state.isSettingsMinimized && (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-xp-text-muted truncate">
              Model: {state.selectedModel.replace('claude-', '').substring(0, 14)}
            </span>
            {state.agentEnabled && (
              <div className="flex flex-shrink-0 items-center gap-1">
                <span className="bg-xp-purple rounded px-1.5 py-0.5 text-[11px] text-white">
                  Agent
                </span>
                {state.autoApprove && (
                  <span className="bg-xp-orange rounded px-1.5 py-0.5 text-[11px] text-white">
                    Auto
                  </span>
                )}
                {state.thinkingEnabled && (
                  <span className="bg-xp-cyan rounded px-1.5 py-0.5 text-[11px] text-white">
                    Think
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Context */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xp-text-muted text-xs">
              Context
              {(() => {
                if (state.contextFiles.length > 0) {
                  return ` (${state.contextFiles.length + (state.includeCurrentFolder ? 1 : 0)})`;
                }
                if (state.includeCurrentFolder) return ' (1)';
                return '';
              })()}
              :
            </span>
            {(state.contextFiles.length > 0 || !state.includeCurrentFolder) && (
              <button
                onClick={resetContext}
                className="text-xp-text-muted hover:text-xp-text text-xs transition-colors"
              >
                Reset
              </button>
            )}
          </div>
          <div className="max-h-24 space-y-1 overflow-y-auto">
            {/* Current folder -- always shown, removable */}
            {state.includeCurrentFolder ? (
              <div className="bg-xp-blue border-xp-blue flex items-center justify-between rounded border border-opacity-20 bg-opacity-10 p-1.5 text-xs">
                <span className="flex flex-1 items-center gap-1.5 truncate">
                  <FolderOpen size={14} className="text-xp-blue flex-shrink-0" />
                  <span className="text-xp-text truncate">
                    {currentPath.split(/[/\\]/).pop() || currentPath}
                  </span>
                  <span className="text-xp-text-muted shrink-0 text-[10px]">current folder</span>
                </span>
                <button
                  onClick={() => setIncludeCurrentFolder(false)}
                  className="text-xp-text-muted hover:text-xp-text ml-1.5 shrink-0 transition-colors"
                  title="Remove current folder from context"
                >
                  {'\u00D7'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIncludeCurrentFolder(true)}
                className="text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light flex w-full items-center gap-1.5 rounded p-1.5 text-xs transition-colors"
              >
                <span>+</span>
                <span>Re-add current folder</span>
              </button>
            )}
            {/* Additional context files */}
            {state.contextFiles.map((file) => (
              <div
                key={file.path}
                className="bg-xp-bg flex items-center justify-between rounded p-1.5 text-xs"
              >
                <span className="flex-1 truncate">{file.name}</span>
                <button
                  onClick={() => removeContextFile(file.path)}
                  className="text-xp-text-muted hover:text-xp-text ml-1.5 transition-colors"
                >
                  {'\u00D7'}
                </button>
              </div>
            ))}
          </div>
          {/* Add more context files */}
          <div className="relative mt-1.5">
            <button
              onClick={() => setIsContextDropdownOpen(!state.isContextDropdownOpen)}
              className="bg-xp-bg border-xp-border hover:bg-xp-surface-light flex w-full items-center gap-2 rounded border px-3 py-1.5 text-xs transition-colors"
              aria-label="Add context files"
              aria-expanded={state.isContextDropdownOpen}
            >
              <span>+ Add context files</span>
            </button>
            {state.isContextDropdownOpen && (
              <div className="bg-xp-popover border-xp-border absolute left-0 right-0 top-full z-50 mt-1 max-h-60 rounded border shadow-xl backdrop-blur-xl">
                <div className="border-xp-border border-b p-2">
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={state.contextSearchQuery}
                    onChange={(e) => setContextSearchQuery(e.target.value)}
                    className="bg-xp-bg border-xp-border w-full rounded border px-2 py-1 text-xs"
                    aria-label="Search context files"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredContextFiles.length > 0 ? (
                    filteredContextFiles.map((file) => (
                      <button
                        key={file.path}
                        onClick={() => addContextFileFromList(file)}
                        className="hover:bg-xp-surface-light flex w-full items-center px-3 py-2 text-left text-xs transition-colors"
                        disabled={state.contextFiles.some((f) => f.path === file.path)}
                      >
                        <span className="mr-2 inline-flex">
                          {file.is_dir ? <FolderClosed size={14} /> : <FileText size={14} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{file.name}</div>
                        </div>
                        {state.contextFiles.some((f) => f.path === file.path) && (
                          <span className="text-xp-green ml-1">{'\u2713'}</span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="text-xp-text-muted px-3 py-2 text-xs">No files available</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Panel or Messages Area */}
      {showHistory ? (
        <div
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            minWidth: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <div className="border-xp-border flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-medium">Chat History ({sessions.length})</span>
            {onClearHistory && sessions.length > 0 && (
              <button
                onClick={() => {
                  onClearHistory();
                  setShowHistory(false);
                }}
                className="text-xp-red text-[10px] hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="space-y-0.5">
            {sessions.length === 0 ? (
              <div className="text-xp-text-muted px-3 py-6 text-center text-xs">No saved chats</div>
            ) : (
              [...sessions]
                .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
                .map((session) => (
                  <div
                    key={session.id}
                    className={`hover:bg-xp-bg-hover group flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors ${
                      currentSessionId === session.id
                        ? 'bg-xp-blue/10 border-xp-blue border-l-2'
                        : ''
                    }`}
                    onClick={() => {
                      onLoadSession?.(session.id);
                      setShowHistory(false);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{session.title}</div>
                      <div className="text-xp-text-muted flex items-center gap-2 text-[10px]">
                        <span>{session.message_count} messages</span>
                        <span>{formatSessionDate(session.updated_at)}</span>
                      </div>
                    </div>
                    {onDeleteSession && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        className="text-xp-text-muted hover:text-xp-red p-1 opacity-0 transition-all group-hover:opacity-100"
                        title="Delete session"
                      >
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      ) : (
        <div
          ref={messagesContainerRef}
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            minWidth: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
          className="space-y-3 px-3 py-3"
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

          {/* Tool Calls Display */}
          <ToolCallsList toolCalls={state.toolCalls} onToggleExpand={toggleToolCallExpand} />

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
                className="bg-xp-bg border-xp-border min-w-0 max-w-[85%] overflow-hidden rounded-lg border"
              >
                <summary className="text-xp-text-muted hover:bg-xp-bg-hover flex cursor-pointer select-none items-center gap-1.5 px-3 py-1.5 text-xs">
                  <div className="bg-xp-cyan h-1.5 w-1.5 animate-pulse rounded-full" />
                  <span>Thinking...</span>
                </summary>
                <div className="text-xp-text-muted border-xp-border max-h-48 overflow-y-auto whitespace-pre-wrap border-t px-3 py-2 text-xs">
                  {state.streamingThinking}
                </div>
              </details>
            </div>
          )}

          {/* Streaming Text */}
          <StreamingMessage text={state.streamingText} />

          {/* Loading indicator (non-agent) */}
          {isAiLoading && !state.isAgentRunning && <LoadingIndicator />}

          {/* Screen reader status announcements */}
          <div className="sr-only" aria-live="assertive">
            {state.isAgentRunning && 'Agent is processing your request'}
            {isAiLoading && !state.isAgentRunning && 'AI is generating a response'}
          </div>
        </div>
      )}

      {/* Input Area */}
      <ChatInput
        chatInput={chatInput}
        setChatInput={setChatInput}
        isAiLoading={isAiLoading}
        isAgentRunning={state.isAgentRunning}
        agentEnabled={state.agentEnabled}
        onSendMessage={handleSendMessage}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default ChatPanel;
