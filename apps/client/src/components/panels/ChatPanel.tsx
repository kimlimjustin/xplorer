import { useState, useEffect, useRef } from 'react';
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
    setIsModelDropdownOpen,
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

  const contextableFiles = allFiles.filter((file) => !file.name.startsWith('.'));
  const filteredContextFiles = contextableFiles.filter(
    (file) =>
      file.name.toLowerCase().includes(state.contextSearchQuery.toLowerCase()) ||
      file.path.toLowerCase().includes(state.contextSearchQuery.toLowerCase()),
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

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isAiLoading || state.isAgentRunning) return;

    if (state.agentEnabled) {
      await handleAgentSend();
    } else {
      // Fallback to simple chat mode
      let combinedContext = selectedFile;
      if (state.contextFiles.length > 0) {
        const contextContents = await Promise.all(
          state.contextFiles.map(async (file) => {
            try {
              const contextNode = await AIService.analyzeContextItem(file.path, 1);
              if (contextNode.is_dir) {
                return `// Directory: ${file.name}\n// Path: ${file.path}\n// Structure:\n${AIService.buildAgentContext(contextNode)}`;
              } else {
                return `// File: ${file.name}\n// Path: ${file.path}\n${contextNode.content || 'Content not available'}`;
              }
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

  const handleAgentSend = async () => {
    const userText = chatInput.trim();
    if (!userText) return;

    // Add user message
    const userMsg: ChatMessage = {
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };
    addChatMessage(userMsg);
    setChatInput('');

    agentSendStart();

    // Build conversation history for the API
    const conversationMessages = [...chatMessages, userMsg].map((m) => ({
      role: m.role as string,
      content: m.content,
    }));

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
      <div className="px-3 py-3 border-b border-xp-border flex-shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-medium truncate">
            {state.agentEnabled ? 'Xplorer Agent' : 'Copilot Assistant'}
          </h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {onNewSession && (
              <button
                onClick={() => {
                  onNewSession();
                  setShowHistory(false);
                }}
                className="p-1 text-xs hover:bg-xp-surface-light rounded transition-colors"
                title="New chat"
                aria-label="Start new chat session"
              >
                <svg
                  className="w-3.5 h-3.5"
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
                className={`p-1 text-xs rounded transition-colors ${showHistory ? 'bg-xp-blue text-white' : 'hover:bg-xp-surface-light'}`}
                title="Chat history"
                aria-label="Toggle chat history"
              >
                <svg
                  className="w-3.5 h-3.5"
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
              className="p-1 text-xs hover:bg-xp-surface-light rounded transition-colors"
              title={state.isSettingsMinimized ? 'Expand settings' : 'Minimize settings'}
              aria-label={
                state.isSettingsMinimized ? 'Expand chat settings' : 'Minimize chat settings'
              }
              aria-expanded={!state.isSettingsMinimized}
            >
              {state.isSettingsMinimized ? '\u2699\uFE0F' : '\u25BC'}
            </button>
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${state.agentEnabled ? 'bg-xp-purple' : state.ollamaStatus ? 'bg-xp-green' : 'bg-xp-red'}`}
            ></div>
            <span className="text-xs text-xp-text-muted whitespace-nowrap">
              {state.agentEnabled
                ? 'Agent Mode'
                : state.ollamaStatus
                  ? 'AI Connected'
                  : 'Limited AI'}
            </span>
          </div>
        </div>

        {/* Expanded Settings */}
        {!state.isSettingsMinimized && (
          <div className="space-y-3">
            {/* Model Selection */}
            <div className="relative">
              <button
                onClick={() => setIsModelDropdownOpen(!state.isModelDropdownOpen)}
                className="flex items-center justify-between w-full px-3 py-2 text-xs bg-xp-bg border border-xp-border rounded hover:bg-xp-bg-hover gap-2 transition-colors"
                aria-label={`Select AI model, current: ${state.selectedModel}`}
                aria-expanded={state.isModelDropdownOpen}
                aria-haspopup="listbox"
              >
                <span className="truncate">{state.selectedModel}</span>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {state.isModelDropdownOpen && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 bg-xp-popover border border-xp-border rounded shadow-xl backdrop-blur-xl z-50"
                  role="listbox"
                  aria-label="AI models"
                >
                  {[
                    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
                    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
                    { id: 'gpt-4o', name: 'GPT-4o' },
                    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
                    { id: 'gpt-4.1', name: 'GPT-4.1' },
                    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
                    { id: 'o3-mini', name: 'o3-mini' },
                    ...state.availableModels
                      .filter(
                        (m) =>
                          !m.id.startsWith('claude-') &&
                          !m.id.startsWith('gpt-') &&
                          !m.id.startsWith('o3'),
                      )
                      .map((m) => ({ id: m.id, name: m.name })),
                  ].map((model) => (
                    <button
                      key={model.id}
                      role="option"
                      aria-selected={state.selectedModel === model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setIsModelDropdownOpen(false);
                        AgentService.getSettings()
                          .then((s) => {
                            AgentService.updateSettings({ ...s, model: model.id });
                          })
                          .catch((err) => {
                            console.warn('Failed to persist model selection:', err);
                          });
                      }}
                      className={`w-full px-3 py-2 text-xs text-left hover:bg-xp-bg-hover transition-colors ${
                        state.selectedModel === model.id
                          ? 'bg-xp-blue bg-opacity-25 text-xp-blue'
                          : ''
                      }`}
                    >
                      {model.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Agent Mode Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-xp-text-muted">Agent Mode:</span>
              <button
                onClick={() => setAgentEnabled(!state.agentEnabled)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
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
                  <span className="text-xs text-xp-text-muted">Auto-Approve</span>
                  <p className="text-[10px] text-xp-text-muted truncate">
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
                  className={`px-3 py-1 text-xs rounded transition-colors ${
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
                  <span className="text-xs text-xp-text-muted">Thinking</span>
                  <p className="text-[10px] text-xp-text-muted truncate">
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
                  className={`px-3 py-1 text-xs rounded transition-colors ${
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
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="px-1.5 py-0.5 bg-xp-purple text-white rounded text-[11px]">
                  Agent
                </span>
                {state.autoApprove && (
                  <span className="px-1.5 py-0.5 bg-xp-orange text-white rounded text-[11px]">
                    Auto
                  </span>
                )}
                {state.thinkingEnabled && (
                  <span className="px-1.5 py-0.5 bg-xp-cyan text-white rounded text-[11px]">
                    Think
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Context */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-xp-text-muted">
              Context
              {state.contextFiles.length > 0
                ? ` (${state.contextFiles.length + (state.includeCurrentFolder ? 1 : 0)})`
                : state.includeCurrentFolder
                  ? ' (1)'
                  : ''}
              :
            </span>
            {(state.contextFiles.length > 0 || !state.includeCurrentFolder) && (
              <button
                onClick={resetContext}
                className="text-xs text-xp-text-muted hover:text-xp-text transition-colors"
              >
                Reset
              </button>
            )}
          </div>
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {/* Current folder -- always shown, removable */}
            {state.includeCurrentFolder ? (
              <div className="flex items-center justify-between p-1.5 bg-xp-blue bg-opacity-10 border border-xp-blue border-opacity-20 rounded text-xs">
                <span className="flex items-center gap-1.5 truncate flex-1">
                  <FolderOpen size={14} className="text-xp-blue flex-shrink-0" />
                  <span className="truncate text-xp-text">
                    {currentPath.split(/[/\\]/).pop() || currentPath}
                  </span>
                  <span className="text-xp-text-muted text-[10px] shrink-0">current folder</span>
                </span>
                <button
                  onClick={() => setIncludeCurrentFolder(false)}
                  className="ml-1.5 text-xp-text-muted hover:text-xp-text transition-colors shrink-0"
                  title="Remove current folder from context"
                >
                  {'\u00D7'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIncludeCurrentFolder(true)}
                className="flex items-center gap-1.5 p-1.5 w-full text-xs text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light rounded transition-colors"
              >
                <span>+</span>
                <span>Re-add current folder</span>
              </button>
            )}
            {/* Additional context files */}
            {state.contextFiles.map((file) => (
              <div
                key={file.path}
                className="flex items-center justify-between p-1.5 bg-xp-bg rounded text-xs"
              >
                <span className="truncate flex-1">{file.name}</span>
                <button
                  onClick={() => removeContextFile(file.path)}
                  className="ml-1.5 text-xp-text-muted hover:text-xp-text transition-colors"
                >
                  {'\u00D7'}
                </button>
              </div>
            ))}
          </div>
          {/* Add more context files */}
          <div className="mt-1.5 relative">
            <button
              onClick={() => setIsContextDropdownOpen(!state.isContextDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs bg-xp-bg border border-xp-border rounded hover:bg-xp-surface-light transition-colors w-full"
              aria-label="Add context files"
              aria-expanded={state.isContextDropdownOpen}
            >
              <span>+ Add context files</span>
            </button>
            {state.isContextDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-xp-popover border border-xp-border rounded shadow-xl backdrop-blur-xl z-50 max-h-60">
                <div className="p-2 border-b border-xp-border">
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={state.contextSearchQuery}
                    onChange={(e) => setContextSearchQuery(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-xp-bg border border-xp-border rounded"
                    aria-label="Search context files"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredContextFiles.length > 0 ? (
                    filteredContextFiles.map((file) => (
                      <button
                        key={file.path}
                        onClick={() => addContextFileFromList(file)}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-xp-surface-light transition-colors flex items-center"
                        disabled={state.contextFiles.some((f) => f.path === file.path)}
                      >
                        <span className="mr-2 inline-flex">{file.is_dir ? <FolderClosed size={14} /> : <FileText size={14} />}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{file.name}</div>
                        </div>
                        {state.contextFiles.some((f) => f.path === file.path) && (
                          <span className="text-xp-green ml-1">{'\u2713'}</span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-xp-text-muted">No files available</div>
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
          <div className="px-3 py-2 border-b border-xp-border flex items-center justify-between">
            <span className="text-xs font-medium">Chat History ({sessions.length})</span>
            {onClearHistory && sessions.length > 0 && (
              <button
                onClick={() => {
                  onClearHistory();
                  setShowHistory(false);
                }}
                className="text-[10px] text-xp-red hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="space-y-0.5">
            {sessions.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-xp-text-muted">No saved chats</div>
            ) : (
              [...sessions]
                .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
                .map((session) => (
                  <div
                    key={session.id}
                    className={`group flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-xp-bg-hover transition-colors ${
                      currentSessionId === session.id
                        ? 'bg-xp-blue/10 border-l-2 border-xp-blue'
                        : ''
                    }`}
                    onClick={() => {
                      onLoadSession?.(session.id);
                      setShowHistory(false);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{session.title}</div>
                      <div className="text-xp-text-muted text-[10px] flex items-center gap-2">
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
                        className="opacity-0 group-hover:opacity-100 p-1 text-xp-text-muted hover:text-xp-red transition-all"
                        title="Delete session"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
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
}

export default ChatPanel;
