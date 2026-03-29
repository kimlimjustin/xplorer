// Mock AIService for web landing page demos

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  model?: string;
  thinking?: string;
  fileContext?: FileContext;
  agentActions?: AgentAction[];
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  available: boolean;
}

export interface FileContext {
  name: string;
  path: string;
  file_type: string;
  content?: string;
  tree?: unknown;
  progress?: AgentProgress[];
}

export interface AgentAction {
  type: 'read_file' | 'read_directory' | 'request_write' | 'write_file';
  path: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'permission_requested';
  result?: unknown;
  error?: string;
  progress?: AgentProgress[];
}

export interface AgentProgress {
  path: string;
  status: string;
}

export type { AgentProgress as AgentProgressType };

export class AIService {
  static async getAvailableModels(): Promise<AIModel[]> {
    return [
      {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        provider: 'anthropic',
        available: true,
      },
      { id: 'llama3.2', name: 'Llama 3.2', provider: 'ollama', available: true },
    ];
  }

  static async checkOllamaStatus(): Promise<boolean> {
    return true;
  }

  static async chatWithAI(
    _model: string,
    _messages: ChatMessage[],
    _fileContext?: FileContext,
  ): Promise<string> {
    return 'This is a demo response.';
  }

  static async analyzeFileWithAI(_model: string, _fileContext: FileContext): Promise<string> {
    return 'Demo analysis result.';
  }

  static async getFileHelp(_model: string, _fileName: string, _fileType: string): Promise<string> {
    return 'Demo file help.';
  }

  static async analyzeFileWithAgent(
    _model: string,
    _filePath: string,
    _maxRecursion?: number,
    _onProgress?: (progress: AgentProgress) => void,
  ): Promise<{ response: string; actions: AgentAction[] }> {
    return { response: 'Demo agent analysis.', actions: [] };
  }

  static async requestWritePermission(
    _filePath: string,
    _content: string,
    _reason: string,
  ): Promise<boolean> {
    return false;
  }

  static async respondToWriteRequest(_requestId: string, _granted: boolean): Promise<void> {}

  static async analyzeContextItem(
    _filePath: string,
    _maxRecursion?: number,
  ): Promise<{
    path: string;
    name: string;
    is_dir: boolean;
    size: number;
    modified: number;
    content?: string;
    children?: unknown;
    error?: string;
  }> {
    return {
      path: _filePath,
      name: 'demo',
      is_dir: false,
      size: 0,
      modified: Date.now(),
      content: '',
    };
  }

  static buildAgentContext(_tree: unknown): string {
    return '';
  }

  static getFileCount(_tree: unknown): string {
    return '0 files, 0 directories';
  }

  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

export default AIService;
