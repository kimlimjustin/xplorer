import React from 'react';
import type { ChatMessage as ChatMessageType } from '@/lib/ai-service';
import type { AgentToolCall, OperationPlan } from '@/lib/agent-service';
import type { ToolCallDisplay, StreamItem } from '@/hooks/use-chat-state';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import {
  BookOpenText,
  FolderOpen,
  Search,
  SearchCheck,
  Monitor,
  Pencil,
  FolderClosed,
  Tag,
  Trash2,
  ArrowRight,
  ClipboardCopy,
  Zap,
  FileText,
  ClipboardList,
  Play,
  Save,
  MessageCircle,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ── Utility helpers ─────────────────────────────────────────────────────────

const TOOL_ICONS: Record<string, LucideIcon> = {
  read_file: BookOpenText,
  list_directory: FolderOpen,
  search_files: Search,
  search_content: SearchCheck,
  get_system_info: Monitor,
  write_file: Pencil,
  create_directory: FolderClosed,
  rename: Tag,
  delete: Trash2,
  move_file: ArrowRight,
  copy_file: ClipboardCopy,
  execute_command: Monitor,
  search_indexed: Zap,
  extract_document_text: FileText,
  create_plan: ClipboardList,
  execute_plan: Play,
  remember: Save,
  recall: MessageCircle,
};

export const getToolIcon = (name: string) : React.ReactNode => {
  const Icon = TOOL_ICONS[name] ?? Wrench;
  return <Icon size={14} className="inline-block" />;
}

export const getToolStatusColor = (status: string) : string => {
  switch (status) {
    case 'completed':
      return 'bg-xp-green';
    case 'running':
      return 'bg-xp-blue animate-pulse';
    case 'pending':
      return 'bg-xp-yellow animate-pulse';
    case 'denied':
      return 'bg-xp-orange';
    case 'error':
      return 'bg-xp-red';
    default:
      return 'bg-xp-text-muted';
  }
}

export const summarizeToolInput = (name: string, input: Record<string, unknown>) : string => {
  switch (name) {
    case 'read_file':
    case 'delete':
    case 'create_directory':
    case 'extract_document_text':
      return String(input.path || '');
    case 'list_directory':
      return String(input.path || '');
    case 'search_files':
      return `${input.pattern} in ${input.path}`;
    case 'search_content':
      return `/${input.pattern}/ in ${input.path}`;
    case 'write_file':
      return String(input.path || '');
    case 'rename':
      return `${input.old_path} -> ${input.new_path}`;
    case 'move_file':
    case 'copy_file':
      return `${input.source} -> ${input.destination}`;
    case 'execute_command':
      return String(input.command || '');
    case 'get_system_info':
      return 'System information';
    case 'search_indexed':
      return String(input.query || '');
    case 'create_plan':
      return String(input.title || '');
    case 'execute_plan':
      return `Plan ${input.plan_id || ''}`;
    case 'remember':
      return `${input.key}: ${String(input.value || '').substring(0, 40)}`;
    case 'recall':
      return input.key
        ? String(input.key)
        : input.category
          ? `category: ${input.category}`
          : 'all memories';
    default:
      return JSON.stringify(input).substring(0, 80);
  }
}

// ── ThinkingBlock ──────────────────────────────────────────────────────────

const ThinkingBlock = ({ content }: { content: string }) => {
  return (
    <details className="mb-2 border border-xp-border rounded-lg overflow-hidden">
      <summary className="px-3 py-1.5 text-xs text-xp-text-muted cursor-pointer hover:bg-xp-bg-hover select-none flex items-center gap-1.5">
        <svg className="w-3 h-3 flex-shrink-0 text-xp-cyan" fill="currentColor" viewBox="0 0 20 20">
          <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM4 11a1 1 0 100-2H3a1 1 0 000 2h1zM10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 110-12 6 6 0 010 12z" />
        </svg>
        <span>Thinking</span>
        <span className="opacity-50">({Math.ceil(content.length / 4)} tokens)</span>
      </summary>
      <div className="px-3 py-2 text-xs text-xp-text-muted bg-xp-surface border-t border-xp-border whitespace-pre-wrap max-h-60 overflow-y-auto">
        {content}
      </div>
    </details>
  );
}

// ── MessageBubble ───────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessageType;
}

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  const modelLabel = message.model
    ? message.model.replace('claude-', '').replace('deepseek-', 'ds-').substring(0, 20)
    : null;

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] min-w-0 rounded-lg p-3 text-sm overflow-hidden ${
          message.role === 'user' ? 'bg-xp-blue text-white' : 'bg-xp-bg border border-xp-border'
        }`}
      >
        {message.role === 'assistant' ? (
          <>
            {message.thinking && <ThinkingBlock content={message.thinking} />}
            <MarkdownRenderer content={message.content} />
            {modelLabel && (
              <div className="mt-1.5 text-[10px] text-xp-text-muted opacity-60">{modelLabel}</div>
            )}
          </>
        ) : (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        )}
      </div>
    </div>
  );
}

// ── ToolCallItem ────────────────────────────────────────────────────────────

interface ToolCallItemProps {
  toolCall: ToolCallDisplay;
  onToggleExpand: (id: string) => void;
}

export const ToolCallItem = ({ toolCall: tc, onToggleExpand }: ToolCallItemProps) => {
  return (
    <div className="bg-xp-bg border border-xp-border rounded-lg overflow-hidden">
      <button
        onClick={() => onToggleExpand(tc.id)}
        className="w-full px-3 py-2 flex items-center space-x-2 text-xs hover:bg-xp-bg-hover transition-colors min-w-0"
        aria-label={`${tc.expanded ? 'Collapse' : 'Expand'} tool call: ${tc.name}`}
        aria-expanded={tc.expanded}
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getToolStatusColor(tc.status)}`} />
        <span className="flex-shrink-0">{getToolIcon(tc.name)}</span>
        <span className="font-medium flex-shrink-0">{tc.name}</span>
        <span className="text-xp-text-muted truncate flex-1 text-left min-w-0">
          {summarizeToolInput(tc.name, tc.input)}
        </span>
        <svg
          className={`w-3 h-3 flex-shrink-0 transition-transform ${tc.expanded ? 'rotate-180' : ''}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {tc.expanded && (
        <div className="px-3 pb-2 border-t border-xp-border min-w-0 overflow-hidden">
          <div className="mt-2 text-xs">
            <div className="text-xp-text-muted mb-1">Input:</div>
            <pre className="bg-xp-surface p-2 rounded text-xs overflow-x-auto max-h-24 overflow-y-auto">
              {JSON.stringify(tc.input, null, 2)}
            </pre>
          </div>
          {tc.result && (
            <div className="mt-2 text-xs">
              <div className="text-xp-text-muted mb-1">Result:</div>
              <pre className="bg-xp-surface p-2 rounded text-xs overflow-x-auto max-h-32 overflow-y-auto">
                {tc.result.length > 2000 ? tc.result.substring(0, 2000) + '...' : tc.result}
              </pre>
            </div>
          )}
          {tc.error && <div className="mt-2 text-xs text-xp-red">{tc.error}</div>}
        </div>
      )}
    </div>
  );
}

// ── ToolCallsList ───────────────────────────────────────────────────────────

interface ToolCallsListProps {
  toolCalls: ToolCallDisplay[];
  onToggleExpand: (id: string) => void;
}

export const ToolCallsList = ({ toolCalls, onToggleExpand }: ToolCallsListProps) => {
  if (toolCalls.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {toolCalls.map((tc) => (
        <ToolCallItem key={tc.id} toolCall={tc} onToggleExpand={onToggleExpand} />
      ))}
    </div>
  );
}

// ── ActivePlanDisplay ───────────────────────────────────────────────────────

interface ActivePlanDisplayProps {
  plan: OperationPlan;
}

export const ActivePlanDisplay = ({ plan }: ActivePlanDisplayProps) => {
  return (
    <div className="bg-xp-surface border border-xp-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-xp-border flex items-center gap-2">
        <span><ClipboardList size={14} className="inline-block" /></span>
        <span className="text-xs font-medium flex-1">{plan.title}</span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            plan.status === 'completed'
              ? 'bg-xp-green text-white'
              : plan.status === 'failed'
                ? 'bg-xp-red text-white'
                : plan.status === 'executing'
                  ? 'bg-xp-blue text-white animate-pulse'
                  : 'bg-xp-yellow text-black'
          }`}
        >
          {plan.status.replace('_', ' ')}
        </span>
      </div>
      <div className="px-3 py-2 space-y-1">
        {plan.steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                step.status === 'completed'
                  ? 'bg-xp-green'
                  : step.status === 'running'
                    ? 'bg-xp-blue animate-pulse'
                    : step.status === 'failed'
                      ? 'bg-xp-red'
                      : step.status === 'skipped'
                        ? 'bg-xp-text-muted'
                        : 'bg-xp-border'
              }`}
            />
            <span
              className={`flex-1 ${step.status === 'skipped' ? 'text-xp-text-muted line-through' : ''}`}
            >
              {step.description}
            </span>
            {step.status === 'completed' && <span className="text-xp-green">{'\u2713'}</span>}
            {step.status === 'failed' && <span className="text-xp-red">{'\u2717'}</span>}
          </div>
        ))}
      </div>
      {plan.status === 'completed' && (
        <div className="px-3 py-1.5 border-t border-xp-border text-xs text-xp-green">
          {'\u2713'} All {plan.total_steps} steps completed
        </div>
      )}
      {plan.status === 'failed' && (
        <div className="px-3 py-1.5 border-t border-xp-border text-xs text-xp-red">
          {'\u2717'} Failed at step {plan.completed_steps + 1} of {plan.total_steps}
        </div>
      )}
    </div>
  );
}

// ── PendingApprovalCard ─────────────────────────────────────────────────────

interface PendingApprovalCardProps {
  toolCall: AgentToolCall;
  activePlan: OperationPlan | null;
  onApproval: (toolCallId: string, response: string) => void;
}

export const PendingApprovalCard = ({
  toolCall: tc,
  activePlan,
  onApproval,
}: PendingApprovalCardProps) => {
  return (
    <div className="bg-xp-yellow/10 border border-xp-yellow rounded-lg p-3">
      <div className="flex items-center space-x-2 mb-2">
        <svg className="w-4 h-4 text-xp-yellow" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-sm font-medium text-xp-yellow">Permission Required</span>
      </div>

      <div className="text-xs space-y-1 mb-3">
        <div>
          <span className="text-xp-text-muted">Action: </span>
          <span className="font-medium">
            {getToolIcon(tc.name)} {tc.name}
          </span>
        </div>
        {tc.name === 'write_file' && (
          <>
            <div>
              <span className="text-xp-text-muted">Path: </span>
              {String((tc.input as Record<string, unknown>).path || '')}
            </div>
            <div className="mt-1">
              <span className="text-xp-text-muted">Content preview:</span>
              <pre className="bg-xp-surface p-2 rounded text-xs max-h-20 overflow-y-auto mt-1">
                {String((tc.input as Record<string, unknown>).content || '').substring(0, 500)}
              </pre>
            </div>
          </>
        )}
        {tc.name === 'execute_command' && (
          <div>
            <span className="text-xp-text-muted">Command: </span>
            <code className="bg-xp-surface px-1 rounded">
              {String((tc.input as Record<string, unknown>).command || '')}
            </code>
          </div>
        )}
        {tc.name === 'delete' && (
          <div className="text-xp-red">
            <span className="text-xp-text-muted">Delete: </span>
            {String((tc.input as Record<string, unknown>).path || '')}
          </div>
        )}
        {(tc.name === 'rename' || tc.name === 'move_file' || tc.name === 'copy_file') && (
          <div>
            <span className="text-xp-text-muted">{tc.name === 'rename' ? 'From' : 'Source'}: </span>
            {String(
              (tc.input as Record<string, unknown>)[tc.name === 'rename' ? 'old_path' : 'source'] ||
                '',
            )}
            <br />
            <span className="text-xp-text-muted">
              {tc.name === 'rename' ? 'To' : 'Destination'}:{' '}
            </span>
            {String(
              (tc.input as Record<string, unknown>)[
                tc.name === 'rename' ? 'new_path' : 'destination'
              ] || '',
            )}
          </div>
        )}
        {tc.name === 'create_directory' && (
          <div>
            <span className="text-xp-text-muted">Path: </span>
            {String((tc.input as Record<string, unknown>).path || '')}
          </div>
        )}
        {tc.name === 'execute_plan' && activePlan && (
          <div>
            <span className="text-xp-text-muted">Plan: </span>
            <span className="font-medium">{activePlan.title}</span>
            <span className="text-xp-text-muted ml-1">({activePlan.total_steps} steps)</span>
          </div>
        )}
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => onApproval(tc.id, 'allow_once')}
          className="px-3 py-1.5 bg-xp-green text-white text-xs rounded hover:opacity-80 font-medium transition-colors flex items-center gap-1"
          aria-label={`Allow ${tc.name} this time`}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          This Time
        </button>
        <button
          onClick={() => onApproval(tc.id, 'allow_always')}
          className="px-3 py-1.5 bg-xp-blue text-white text-xs rounded hover:opacity-80 font-medium transition-colors flex items-center gap-1"
          aria-label={`Always allow ${tc.name}`}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
          Always
        </button>
        <button
          onClick={() => onApproval(tc.id, 'deny_always')}
          className="px-3 py-1.5 bg-xp-red text-white text-xs rounded hover:opacity-80 font-medium transition-colors flex items-center gap-1"
          aria-label={`Never allow ${tc.name}`}
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Never
        </button>
      </div>
    </div>
  );
}

// ── StreamingMessage ────────────────────────────────────────────────────────

interface StreamingMessageProps {
  text: string;
}

export const StreamingMessage = ({ text }: StreamingMessageProps) => {
  if (!text) return null;

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] min-w-0 rounded-lg p-3 text-sm overflow-hidden bg-xp-bg border border-xp-border">
        <MarkdownRenderer content={text} />
        <div className="mt-1 flex items-center space-x-1">
          <div className="w-1.5 h-1.5 bg-xp-purple rounded-full animate-pulse" />
          <span className="text-xs text-xp-text-muted">Agent is responding...</span>
        </div>
      </div>
    </div>
  );
}

// ── AgentStreamView ─────────────────────────────────────────────────────────

interface AgentStreamViewProps {
  streamItems: StreamItem[];
  toolCalls: ToolCallDisplay[];
  onToggleExpand: (id: string) => void;
  isStreaming: boolean;
}

export const AgentStreamView = ({
  streamItems,
  toolCalls,
  onToggleExpand,
  isStreaming,
}: AgentStreamViewProps) => {
  return (
    <div className="space-y-2">
      {streamItems.map((item, index) => {
        if (item.kind === 'text') {
          return (
            <div key={`stream-text-${index}`} className="flex justify-start">
              <div className="max-w-[85%] min-w-0 rounded-lg p-3 text-sm overflow-hidden bg-xp-bg border border-xp-border">
                <MarkdownRenderer content={item.content} />
              </div>
            </div>
          );
        }
        if (item.kind === 'tool_call') {
          const tc = toolCalls.find((t) => t.id === item.toolCallId);
          if (!tc) return null;
          return <ToolCallItem key={tc.id} toolCall={tc} onToggleExpand={onToggleExpand} />;
        }
        return null;
      })}
      {isStreaming && (
        <div className="flex items-center space-x-1 px-1">
          <div className="w-1.5 h-1.5 bg-xp-purple rounded-full animate-pulse" />
          <span className="text-xs text-xp-text-muted">Agent is working...</span>
        </div>
      )}
    </div>
  );
}

// ── LoadingIndicator ────────────────────────────────────────────────────────

export const LoadingIndicator = () => {
  return (
    <div className="flex justify-start">
      <div className="bg-xp-bg border border-xp-border rounded-lg p-3">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-xp-blue rounded-full animate-pulse" />
          <div
            className="w-2 h-2 bg-xp-blue rounded-full animate-pulse"
            style={{ animationDelay: '0.2s' }}
          />
          <div
            className="w-2 h-2 bg-xp-blue rounded-full animate-pulse"
            style={{ animationDelay: '0.4s' }}
          />
          <span className="text-xs text-xp-text-muted">Thinking...</span>
        </div>
      </div>
    </div>
  );
}

// ── EmptyState ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  agentEnabled: boolean;
}

export const EmptyState = ({ agentEnabled }: EmptyStateProps) => {
  return (
    <div className="text-center text-xp-text-muted py-8">
      <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
          clipRule="evenodd"
        />
      </svg>
      <p className="font-medium">{agentEnabled ? 'Xplorer Agent' : 'Copilot Assistant'}</p>
      <p className="text-xs mt-1">
        {agentEnabled
          ? 'Ask me to manage files, search, organize, or run commands'
          : 'Ask about your files'}
      </p>
    </div>
  );
}
