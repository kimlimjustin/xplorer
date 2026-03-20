// AIModel and FileContext types removed — no longer used directly
import type { ChatState } from '@/hooks/use-chat-state';
import { AgentService } from '@/lib/agent-service';
import { FolderOpen, FolderClosed, FileText } from 'lucide-react';

interface ChatHeaderProps {
  state: ChatState;
  currentPath: string;
  onNewSession?: () => void;
  onToggleHistory: () => void;
  showHistory: boolean;
  sessionsCount: number;
  // State setters
  setIsSettingsMinimized: (minimized: boolean) => void;
  setIsModelDropdownOpen: (open: boolean) => void;
  setSelectedModel: (model: string) => void;
  setAgentEnabled: (enabled: boolean) => void;
  setAutoApprove: (autoApprove: boolean) => void;
  setThinkingEnabled: (enabled: boolean) => void;
  setIsContextDropdownOpen: (open: boolean) => void;
  setContextSearchQuery: (query: string) => void;
  setIncludeCurrentFolder: (include: boolean) => void;
  removeContextFile: (path: string) => void;
  resetContext: () => void;
  addContextFileFromList: (file: {
    name: string;
    path: string;
    file_type: string;
    is_dir: boolean;
  }) => void;
  filteredContextFiles: Array<{ name: string; path: string; file_type: string; is_dir: boolean }>;
}

const ChatHeader = ({
  state,
  currentPath,
  onNewSession,
  onToggleHistory,
  showHistory,
  sessionsCount,
  setIsSettingsMinimized,
  setIsModelDropdownOpen,
  setSelectedModel,
  setAgentEnabled,
  setAutoApprove,
  setThinkingEnabled,
  setIsContextDropdownOpen,
  setContextSearchQuery,
  setIncludeCurrentFolder,
  removeContextFile,
  resetContext,
  addContextFileFromList,
  filteredContextFiles,
}: ChatHeaderProps) => {
  return (
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
          {sessionsCount > 0 && (
            <button
              onClick={onToggleHistory}
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
            {state.agentEnabled ? 'Agent Mode' : state.ollamaStatus ? 'AI Connected' : 'Limited AI'}
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
  );
}

export default ChatHeader;
