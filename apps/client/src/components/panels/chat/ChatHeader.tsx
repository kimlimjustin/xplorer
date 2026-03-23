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
  setIsModelDropdownOpen: _setIsModelDropdownOpen,
  setSelectedModel: _setSelectedModel,
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
          {sessionsCount > 0 && (
            <button
              onClick={onToggleHistory}
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
  );
};

export default ChatHeader;
