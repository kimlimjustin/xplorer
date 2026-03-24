import { transport } from '../transport';
import type {
  FileSystemNode,
  AgentProgress,
  SafeAgentSettings,
  UpdateAgentSettingsPayload,
  UpdateAgentApiKeysPayload,
} from '../tauri-api-types';

// ── AI model operations ─────────────────────────────────────────────────────

export const getAiModels = async (): Promise<
  {
    id: string;
    name: string;
    provider: string;
    available: boolean;
  }[]
> => await transport('get_ai_models');

export const checkOllamaStatus = async (): Promise<boolean> =>
  await transport('check_ollama_status');

// ── AI chat / analysis ──────────────────────────────────────────────────────

export const chatWithAI = async (
  model: string,
  messages: { role: string; content: string }[],
  fileContext?: { name: string; path: string; file_type: string; content?: string } | null,
): Promise<string> =>
  await transport('chat_with_ai', {
    model,
    messages,
    fileContext: fileContext || null,
  });

export const analyzeFileWithAI = async (
  model: string,
  fileContext: { name: string; path: string; file_type: string; content?: string },
): Promise<string> =>
  await transport('analyze_file_with_ai', {
    model,
    fileContext,
  });

export const getFileHelp = async (
  model: string,
  fileName: string,
  fileType: string,
): Promise<string> =>
  await transport('get_file_help', {
    model,
    fileName,
    fileType,
  });

// ── AI-powered rename suggestions ───────────────────────────────────────────

export const suggestFilename = async (filePath: string): Promise<string[]> =>
  await transport('suggest_filename', { filePath });

// ── AI-powered auto-tagging by content ──────────────────────────────────────

export const autoTagFiles = async (filePaths: string[]): Promise<[string, string[]][]> =>
  await transport('auto_tag_files', { filePaths });

// ── AI Agent operations ─────────────────────────────────────────────────────

export const agentReadFileTree = async (
  rootPath: string,
  maxRecursion?: number,
  includeContent?: boolean,
): Promise<{ tree: FileSystemNode; progress: AgentProgress[] }> => {
  const result = await transport('agent_read_file_tree', {
    rootPath,
    maxRecursion: maxRecursion || 10,
    includeContent: includeContent !== false,
  });
  const [tree, progress] = result as [FileSystemNode, AgentProgress[]];
  return { tree, progress };
};

export const agentRequestWritePermission = async (
  filePath: string,
  content: string,
  reason: string,
): Promise<string> =>
  await transport('agent_request_write_permission', { filePath, content, reason });

export const agentWriteFileWithPermission = async (
  filePath: string,
  content: string,
  permissionGranted: boolean,
): Promise<void> =>
  await transport('agent_write_file_with_permission', {
    filePath,
    content,
    permissionGranted,
  });

// ── Claude Agent operations ─────────────────────────────────────────────────

export const agentRespondApproval = async (toolCallId: string, approved: boolean): Promise<void> =>
  await transport('agent_respond_approval', { toolCallId, approved });

export const agentCancelSession = async (sessionId: string): Promise<void> =>
  await transport('agent_cancel_session', { sessionId });

export const getAgentSettings = async (): Promise<SafeAgentSettings> =>
  await transport('get_agent_settings');

export const updateAgentSettings = async (settings: UpdateAgentSettingsPayload): Promise<void> =>
  await transport('update_agent_settings', { settings });

export const updateAgentApiKeys = async (payload: UpdateAgentApiKeysPayload): Promise<void> =>
  await transport('update_agent_api_keys', { payload });
