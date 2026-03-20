import { useReducer, useCallback } from 'react';
import type { AIModel, FileContext } from '@/lib/ai-service';
import type { AgentToolCall, OperationPlan } from '@/lib/agent-service';

// ── Tool call display type ─────────────────────────────────────────────────

export interface ToolCallDisplay {
  id: string;
  name: string;
  input: Record<string, unknown>;
  requires_approval: boolean;
  status: string;
  result?: string;
  error?: string;
  expanded: boolean;
}

// ── Stream item type for interleaved agent output ───────────────────────────

export type StreamItem =
  | { kind: 'text'; content: string }
  | { kind: 'tool_call'; toolCallId: string };

// ── State shape ─────────────────────────────────────────────────────────────

export interface ChatState {
  // Model / connectivity
  availableModels: AIModel[];
  selectedModel: string;
  ollamaStatus: boolean;

  // UI dropdowns / panels
  isModelDropdownOpen: boolean;
  isContextDropdownOpen: boolean;
  isSettingsMinimized: boolean;
  contextSearchQuery: string;

  // Context
  contextFiles: FileContext[];
  includeCurrentFolder: boolean;

  // Agent
  agentEnabled: boolean;
  autoApprove: boolean;
  thinkingEnabled: boolean;
  isAgentRunning: boolean;
  toolCalls: ToolCallDisplay[];
  pendingApprovals: AgentToolCall[];
  streamingText: string;
  streamingThinking: string;
  streamItems: StreamItem[];
  activePlan: OperationPlan | null;
}

// ── Actions ─────────────────────────────────────────────────────────────────

export type ChatAction =
  | { type: 'SET_AVAILABLE_MODELS'; models: AIModel[] }
  | { type: 'SET_SELECTED_MODEL'; model: string }
  | { type: 'SET_OLLAMA_STATUS'; status: boolean }
  | { type: 'SET_MODEL_DROPDOWN_OPEN'; open: boolean }
  | { type: 'SET_CONTEXT_DROPDOWN_OPEN'; open: boolean }
  | { type: 'SET_SETTINGS_MINIMIZED'; minimized: boolean }
  | { type: 'SET_CONTEXT_SEARCH_QUERY'; query: string }
  | { type: 'SET_CONTEXT_FILES'; files: FileContext[] }
  | { type: 'ADD_CONTEXT_FILE'; file: FileContext }
  | { type: 'REMOVE_CONTEXT_FILE'; path: string }
  | { type: 'SET_INCLUDE_CURRENT_FOLDER'; include: boolean }
  | { type: 'SET_AGENT_ENABLED'; enabled: boolean }
  | { type: 'SET_AUTO_APPROVE'; autoApprove: boolean }
  | { type: 'SET_THINKING_ENABLED'; enabled: boolean }
  | { type: 'SET_AGENT_RUNNING'; running: boolean }
  | { type: 'SET_TOOL_CALLS'; toolCalls: ToolCallDisplay[] }
  | { type: 'UPSERT_TOOL_CALL'; toolCall: ToolCallDisplay }
  | { type: 'UPDATE_TOOL_CALL'; id: string; updates: Partial<ToolCallDisplay> }
  | { type: 'TOGGLE_TOOL_CALL_EXPAND'; id: string }
  | { type: 'SET_PENDING_APPROVALS'; approvals: AgentToolCall[] }
  | { type: 'ADD_PENDING_APPROVAL'; approval: AgentToolCall }
  | { type: 'REMOVE_PENDING_APPROVAL'; id: string }
  | { type: 'SET_STREAMING_TEXT'; text: string }
  | { type: 'SET_STREAMING_THINKING'; text: string }
  | { type: 'SET_STREAM_ITEMS'; items: StreamItem[] }
  | { type: 'ADD_STREAM_ITEM'; item: StreamItem }
  | { type: 'SET_ACTIVE_PLAN'; plan: OperationPlan | null }
  | { type: 'CLOSE_ALL_DROPDOWNS' }
  | { type: 'AGENT_SEND_START' }
  | { type: 'AGENT_SEND_COMPLETE' }
  | { type: 'AGENT_SEND_ERROR' }
  | { type: 'RESET_CONTEXT' };

// ── Initial state ──────────────────────────────────────────────────────────

const initialState: ChatState = {
  availableModels: [],
  selectedModel: 'claude-sonnet-4-6',
  ollamaStatus: false,
  isModelDropdownOpen: false,
  isContextDropdownOpen: false,
  isSettingsMinimized: true,
  contextSearchQuery: '',
  contextFiles: [],
  includeCurrentFolder: true,
  agentEnabled: true,
  autoApprove: false,
  thinkingEnabled: false,
  isAgentRunning: false,
  toolCalls: [],
  pendingApprovals: [],
  streamingText: '',
  streamingThinking: '',
  streamItems: [],
  activePlan: null,
};

// ── Reducer ─────────────────────────────────────────────────────────────────

const chatReducer = (state: ChatState, action: ChatAction) : ChatState => {
  switch (action.type) {
    case 'SET_AVAILABLE_MODELS':
      return { ...state, availableModels: action.models };

    case 'SET_SELECTED_MODEL':
      return { ...state, selectedModel: action.model };

    case 'SET_OLLAMA_STATUS':
      return { ...state, ollamaStatus: action.status };

    case 'SET_MODEL_DROPDOWN_OPEN':
      return { ...state, isModelDropdownOpen: action.open };

    case 'SET_CONTEXT_DROPDOWN_OPEN':
      return { ...state, isContextDropdownOpen: action.open };

    case 'SET_SETTINGS_MINIMIZED':
      return { ...state, isSettingsMinimized: action.minimized };

    case 'SET_CONTEXT_SEARCH_QUERY':
      return { ...state, contextSearchQuery: action.query };

    case 'SET_CONTEXT_FILES':
      return { ...state, contextFiles: action.files };

    case 'ADD_CONTEXT_FILE':
      if (state.contextFiles.some((f) => f.path === action.file.path)) {
        return state;
      }
      return { ...state, contextFiles: [...state.contextFiles, action.file] };

    case 'REMOVE_CONTEXT_FILE':
      return { ...state, contextFiles: state.contextFiles.filter((f) => f.path !== action.path) };

    case 'SET_INCLUDE_CURRENT_FOLDER':
      return { ...state, includeCurrentFolder: action.include };

    case 'SET_AGENT_ENABLED':
      return { ...state, agentEnabled: action.enabled };

    case 'SET_AUTO_APPROVE':
      return { ...state, autoApprove: action.autoApprove };

    case 'SET_THINKING_ENABLED':
      return { ...state, thinkingEnabled: action.enabled };

    case 'SET_AGENT_RUNNING':
      return { ...state, isAgentRunning: action.running };

    case 'SET_TOOL_CALLS':
      return { ...state, toolCalls: action.toolCalls };

    case 'UPSERT_TOOL_CALL': {
      const existing = state.toolCalls.filter((t) => t.id !== action.toolCall.id);
      return { ...state, toolCalls: [...existing, action.toolCall] };
    }

    case 'UPDATE_TOOL_CALL':
      return {
        ...state,
        toolCalls: state.toolCalls.map((t) =>
          t.id === action.id ? { ...t, ...action.updates } : t,
        ),
      };

    case 'TOGGLE_TOOL_CALL_EXPAND':
      return {
        ...state,
        toolCalls: state.toolCalls.map((t) =>
          t.id === action.id ? { ...t, expanded: !t.expanded } : t,
        ),
      };

    case 'SET_PENDING_APPROVALS':
      return { ...state, pendingApprovals: action.approvals };

    case 'ADD_PENDING_APPROVAL':
      return { ...state, pendingApprovals: [...state.pendingApprovals, action.approval] };

    case 'REMOVE_PENDING_APPROVAL':
      return {
        ...state,
        pendingApprovals: state.pendingApprovals.filter((p) => p.id !== action.id),
      };

    case 'SET_STREAMING_TEXT':
      return { ...state, streamingText: action.text };

    case 'SET_STREAMING_THINKING':
      return { ...state, streamingThinking: action.text };

    case 'SET_STREAM_ITEMS':
      return { ...state, streamItems: action.items };

    case 'ADD_STREAM_ITEM':
      return { ...state, streamItems: [...state.streamItems, action.item] };

    case 'SET_ACTIVE_PLAN':
      return { ...state, activePlan: action.plan };

    case 'CLOSE_ALL_DROPDOWNS':
      return { ...state, isModelDropdownOpen: false, isContextDropdownOpen: false };

    case 'AGENT_SEND_START':
      return {
        ...state,
        isAgentRunning: true,
        toolCalls: [],
        pendingApprovals: [],
        streamingText: '',
        streamingThinking: '',
        streamItems: [],
      };

    case 'AGENT_SEND_COMPLETE':
      return {
        ...state,
        streamingText: '',
        streamingThinking: '',
        streamItems: [],
        isAgentRunning: false,
        activePlan: null,
      };

    case 'AGENT_SEND_ERROR':
      return {
        ...state,
        streamingText: '',
        streamingThinking: '',
        streamItems: [],
        isAgentRunning: false,
        activePlan: null,
      };

    case 'RESET_CONTEXT':
      return { ...state, contextFiles: [], includeCurrentFolder: true };

    default:
      return state;
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export const useChatState = () => {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Convenience dispatchers (memoized) for the most common operations
  const setAvailableModels = useCallback(
    (models: AIModel[]) => dispatch({ type: 'SET_AVAILABLE_MODELS', models }),
    [],
  );
  const setSelectedModel = useCallback(
    (model: string) => dispatch({ type: 'SET_SELECTED_MODEL', model }),
    [],
  );
  const setOllamaStatus = useCallback(
    (status: boolean) => dispatch({ type: 'SET_OLLAMA_STATUS', status }),
    [],
  );
  const setIsModelDropdownOpen = useCallback(
    (open: boolean) => dispatch({ type: 'SET_MODEL_DROPDOWN_OPEN', open }),
    [],
  );
  const setIsContextDropdownOpen = useCallback(
    (open: boolean) => dispatch({ type: 'SET_CONTEXT_DROPDOWN_OPEN', open }),
    [],
  );
  const setIsSettingsMinimized = useCallback(
    (minimized: boolean) => dispatch({ type: 'SET_SETTINGS_MINIMIZED', minimized }),
    [],
  );
  const setContextSearchQuery = useCallback(
    (query: string) => dispatch({ type: 'SET_CONTEXT_SEARCH_QUERY', query }),
    [],
  );
  const setContextFiles = useCallback(
    (files: FileContext[]) => dispatch({ type: 'SET_CONTEXT_FILES', files }),
    [],
  );
  const addContextFile = useCallback(
    (file: FileContext) => dispatch({ type: 'ADD_CONTEXT_FILE', file }),
    [],
  );
  const removeContextFile = useCallback(
    (path: string) => dispatch({ type: 'REMOVE_CONTEXT_FILE', path }),
    [],
  );
  const setIncludeCurrentFolder = useCallback(
    (include: boolean) => dispatch({ type: 'SET_INCLUDE_CURRENT_FOLDER', include }),
    [],
  );
  const setAgentEnabled = useCallback(
    (enabled: boolean) => dispatch({ type: 'SET_AGENT_ENABLED', enabled }),
    [],
  );
  const setAutoApprove = useCallback(
    (autoApprove: boolean) => dispatch({ type: 'SET_AUTO_APPROVE', autoApprove }),
    [],
  );
  const setThinkingEnabled = useCallback(
    (enabled: boolean) => dispatch({ type: 'SET_THINKING_ENABLED', enabled }),
    [],
  );
  const setIsAgentRunning = useCallback(
    (running: boolean) => dispatch({ type: 'SET_AGENT_RUNNING', running }),
    [],
  );
  const setStreamingText = useCallback(
    (text: string) => dispatch({ type: 'SET_STREAMING_TEXT', text }),
    [],
  );
  const setStreamingThinking = useCallback(
    (text: string) => dispatch({ type: 'SET_STREAMING_THINKING', text }),
    [],
  );
  const setStreamItems = useCallback(
    (items: StreamItem[]) => dispatch({ type: 'SET_STREAM_ITEMS', items }),
    [],
  );
  const addStreamItem = useCallback(
    (item: StreamItem) => dispatch({ type: 'ADD_STREAM_ITEM', item }),
    [],
  );
  const setActivePlan = useCallback(
    (plan: OperationPlan | null) => dispatch({ type: 'SET_ACTIVE_PLAN', plan }),
    [],
  );
  const toggleToolCallExpand = useCallback(
    (id: string) => dispatch({ type: 'TOGGLE_TOOL_CALL_EXPAND', id }),
    [],
  );
  const upsertToolCall = useCallback(
    (toolCall: ToolCallDisplay) => dispatch({ type: 'UPSERT_TOOL_CALL', toolCall }),
    [],
  );
  const updateToolCall = useCallback(
    (id: string, updates: Partial<ToolCallDisplay>) =>
      dispatch({ type: 'UPDATE_TOOL_CALL', id, updates }),
    [],
  );
  const addPendingApproval = useCallback(
    (approval: AgentToolCall) => dispatch({ type: 'ADD_PENDING_APPROVAL', approval }),
    [],
  );
  const removePendingApproval = useCallback(
    (id: string) => dispatch({ type: 'REMOVE_PENDING_APPROVAL', id }),
    [],
  );
  const closeAllDropdowns = useCallback(() => dispatch({ type: 'CLOSE_ALL_DROPDOWNS' }), []);
  const agentSendStart = useCallback(() => dispatch({ type: 'AGENT_SEND_START' }), []);
  const agentSendComplete = useCallback(() => dispatch({ type: 'AGENT_SEND_COMPLETE' }), []);
  const agentSendError = useCallback(() => dispatch({ type: 'AGENT_SEND_ERROR' }), []);
  const resetContext = useCallback(() => dispatch({ type: 'RESET_CONTEXT' }), []);

  return {
    state,
    dispatch,
    // Convenience setters
    setAvailableModels,
    setSelectedModel,
    setOllamaStatus,
    setIsModelDropdownOpen,
    setIsContextDropdownOpen,
    setIsSettingsMinimized,
    setContextSearchQuery,
    setContextFiles,
    addContextFile,
    removeContextFile,
    setIncludeCurrentFolder,
    setAgentEnabled,
    setAutoApprove,
    setThinkingEnabled,
    setIsAgentRunning,
    setStreamingText,
    setStreamingThinking,
    setStreamItems,
    addStreamItem,
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
  };
}
