import { transport } from '../transport';
import type {
  ChatSessionSummary,
  ChatSession,
  ChatFileData,
  ChatFileSummary,
} from '../types';

export const getChatSessions = async (): Promise<ChatSessionSummary[]> => {
  return await transport('get_chat_sessions');
};

export const getChatSession = async (sessionId: string): Promise<ChatSession | null> => {
  return await transport('get_chat_session', { sessionId });
};

export const saveChatSession = async (session: ChatSession): Promise<void> => {
  return await transport('save_chat_session', { session });
};

export const deleteChatSession = async (sessionId: string): Promise<void> => {
  return await transport('delete_chat_session', { sessionId });
};

export const clearChatHistory = async (): Promise<void> => {
  return await transport('clear_chat_history');
};

export const getChatsDirectory = async (): Promise<string> => {
  return await transport('get_chats_directory');
};

export const createChatFile = async (directory: string, title?: string): Promise<string> => {
  return await transport('create_chat_file', { directory, title: title || null });
};

export const readChatFile = async (path: string): Promise<ChatFileData> => {
  return await transport('read_chat_file', { path });
};

export const saveChatFile = async (path: string, data: ChatFileData): Promise<void> => {
  return await transport('save_chat_file', { path, data });
};

export const getChatFileSummary = async (path: string): Promise<ChatFileSummary> => {
  return await transport('get_chat_file_summary', { path });
};
