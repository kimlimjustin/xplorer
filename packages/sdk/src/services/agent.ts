import { transport } from '../transport';
import type {
  FileSystemNode,
  AgentProgress,
  SafeAgentSettings,
  UpdateAgentSettingsPayload,
  UpdateAgentApiKeysPayload,
} from '../types';

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
): Promise<string> => {
  return await transport('agent_request_write_permission', { filePath, content, reason });
};

export const agentWriteFileWithPermission = async (
  filePath: string,
  content: string,
  permissionGranted: boolean,
): Promise<void> => {
  return await transport('agent_write_file_with_permission', {
    filePath,
    content,
    permissionGranted,
  });
};

export const agentRespondApproval = async (
  toolCallId: string,
  approved: boolean,
): Promise<void> => {
  return await transport('agent_respond_approval', { toolCallId, approved });
};

export const agentCancelSession = async (sessionId: string): Promise<void> => {
  return await transport('agent_cancel_session', { sessionId });
};

export const getAgentSettings = async (): Promise<SafeAgentSettings> => {
  return await transport('get_agent_settings');
};

export const updateAgentSettings = async (settings: UpdateAgentSettingsPayload): Promise<void> => {
  return await transport('update_agent_settings', { settings });
};

export const updateAgentApiKeys = async (payload: UpdateAgentApiKeysPayload): Promise<void> => {
  return await transport('update_agent_api_keys', { payload });
};
