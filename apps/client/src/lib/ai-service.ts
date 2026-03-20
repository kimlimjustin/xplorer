import { TauriAPI, type FileSystemNode, type AgentProgress } from './tauri-api';

export type { AgentProgress } from './tauri-api';

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
  tree?: FileSystemNode; // For agent context
  progress?: AgentProgress[]; // For showing agent progress
}

export interface AgentAction {
  type: 'read_file' | 'read_directory' | 'request_write' | 'write_file';
  path: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'permission_requested';
  result?: unknown;
  error?: string;
  progress?: AgentProgress[];
}

export class AIService {
  private static pendingWriteRequests = new Map<
    string,
    {
      filePath: string;
      content: string;
      reason: string;
      resolve: (granted: boolean) => void;
    }
  >();

  /**
   * Get available AI models
   */
  static async getAvailableModels(): Promise<AIModel[]> {
    try {
      return await TauriAPI.getAiModels();
    } catch (error) {
      console.error('Failed to get AI models:', error);
      throw new Error('Failed to get AI models', { cause: error });
    }
  }

  /**
   * Check if Ollama is running and available
   */
  static async checkOllamaStatus(): Promise<boolean> {
    try {
      return await TauriAPI.checkOllamaStatus();
    } catch (error) {
      console.error('Failed to check Ollama status:', error);
      return false;
    }
  }

  /**
   * Chat with AI using the specified model
   */
  static async chatWithAI(
    model: string,
    messages: ChatMessage[],
    fileContext?: FileContext,
  ): Promise<string> {
    try {
      return await TauriAPI.chatWithAI(model, messages, fileContext);
    } catch (error) {
      console.error('AI chat error:', error);
      throw new Error(`AI chat failed: ${error}`, { cause: error });
    }
  }

  /**
   * Analyze a file with AI
   */
  static async analyzeFileWithAI(model: string, fileContext: FileContext): Promise<string> {
    try {
      return await TauriAPI.analyzeFileWithAI(model, fileContext);
    } catch (error) {
      console.error('AI file analysis error:', error);
      throw new Error(`File analysis failed: ${error}`, { cause: error });
    }
  }

  /**
   * Get help information about a file type
   */
  static async getFileHelp(model: string, fileName: string, fileType: string): Promise<string> {
    try {
      return await TauriAPI.getFileHelp(model, fileName, fileType);
    } catch (error) {
      console.error('AI file help error:', error);
      throw new Error(`File help failed: ${error}`, { cause: error });
    }
  }

  /**
   * Analyze file/directory with AI agent capabilities
   */
  static async analyzeFileWithAgent(
    model: string,
    filePath: string,
    maxRecursion: number = 3,
    onProgress?: (progress: AgentProgress) => void,
  ): Promise<{ response: string; actions: AgentAction[] }> {
    const actions: AgentAction[] = [];

    try {
      // Start reading the file/directory tree
      actions.push({
        type: 'read_directory',
        path: filePath,
        status: 'in_progress',
      });

      const { tree, progress } = await TauriAPI.agentReadFileTree(filePath, maxRecursion, true);

      // Report progress
      if (onProgress) {
        progress.forEach((p) => onProgress(p));
      }

      actions[actions.length - 1].status = 'completed';
      actions[actions.length - 1].result = tree;
      actions[actions.length - 1].progress = progress;

      // Create comprehensive context for the AI
      const context = this.buildAgentContext(tree);

      // Send to AI with agent instructions
      const systemPrompt = `You are an AI file system agent with the following capabilities:
1. You can read files and directories recursively (already done for the current context)
2. You can request permission to write files (use agentRequestWrite function)
3. You have access to the complete file tree structure and content

IMPORTANT RULES:
- You MUST ask for permission before writing any files
- You can only work within the given file context and its children
- Maximum recursion depth is ${maxRecursion}
- You should analyze the provided file structure and content to give helpful insights

Current context: ${filePath}
Files and directories analyzed: ${this.getFileCount(tree)}

Here is the complete file structure and content:
${JSON.stringify(tree, null, 2)}`;

      const response = await TauriAPI.chatWithAI(
        model,
        [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Please analyze this file/directory structure and provide insights. The root path is: ${filePath}`,
          },
        ],
        {
          name: tree.name,
          path: tree.path,
          file_type: tree.is_dir ? 'directory' : tree.name.split('.').pop() || 'unknown',
          content: context,
        },
      );

      return { response, actions };
    } catch (error) {
      actions.push({
        type: 'read_directory',
        path: filePath,
        status: 'failed',
        error: (error as Error).message,
      });

      throw error;
    }
  }

  /**
   * Request permission to write a file
   */
  static async requestWritePermission(
    filePath: string,
    content: string,
    reason: string,
  ): Promise<boolean> {
    try {
      const requestId = await TauriAPI.agentRequestWritePermission(filePath, content, reason);

      return new Promise((resolve) => {
        this.pendingWriteRequests.set(requestId, {
          filePath,
          content,
          reason,
          resolve,
        });

        // Emit an event that the UI can listen to
        window.dispatchEvent(
          new CustomEvent('ai-write-permission-request', {
            detail: { requestId, filePath, content, reason },
          }),
        );
      });
    } catch (error) {
      console.error('Failed to request write permission:', error);
      return false;
    }
  }

  /**
   * Respond to a write permission request
   */
  static async respondToWriteRequest(requestId: string, granted: boolean): Promise<void> {
    const request = this.pendingWriteRequests.get(requestId);
    if (!request) return;

    try {
      if (granted) {
        await TauriAPI.agentWriteFileWithPermission(request.filePath, request.content, true);
      }
      request.resolve(granted);
    } finally {
      this.pendingWriteRequests.delete(requestId);
    }
  }

  /**
   * Analyze a file or folder and get its content for context
   */
  static async analyzeContextItem(
    filePath: string,
    maxRecursion: number = 3,
    onProgress?: (progress: AgentProgress) => void,
  ): Promise<FileSystemNode> {
    try {
      // First check if it's a file or directory
      const isDirectory = await TauriAPI.isDir(filePath);

      if (isDirectory) {
        // It's a directory, read the tree structure
        const { tree, progress } = await TauriAPI.agentReadFileTree(filePath, maxRecursion, true);

        // Report progress
        if (onProgress) {
          progress.forEach((p) => onProgress(p));
        }

        return tree;
      } else {
        // It's a file, read its content
        try {
          const content = await TauriAPI.readTextFile(filePath);
          const metadata = await TauriAPI.getFileProperties(filePath);

          return {
            path: filePath,
            name: metadata.name,
            is_dir: false,
            size: metadata.size,
            modified: metadata.modified,
            content,
            children: undefined,
            error: undefined,
          };
        } catch (error) {
          // If reading as text fails, it might be binary
          const metadata = await TauriAPI.getFileProperties(filePath);

          return {
            path: filePath,
            name: metadata.name,
            is_dir: false,
            size: metadata.size,
            modified: metadata.modified,
            content: undefined,
            children: undefined,
            error: `Binary file or read error: ${error}`,
          };
        }
      }
    } catch (error) {
      throw new Error(`Failed to analyze context item: ${error}`, { cause: error });
    }
  }

  static buildAgentContext(tree: FileSystemNode): string {
    let context = '';

    const addNode = (node: FileSystemNode, depth: number = 0): void => {
      const indent = '  '.repeat(depth);

      if (node.is_dir) {
        context += `${indent}[dir] ${node.name}/\n`;
        if (node.children) {
          node.children.forEach((child) => addNode(child, depth + 1));
        }
      } else {
        context += `${indent}     ${node.name}`;
        if (node.size) {
          context += ` (${this.formatFileSize(node.size)})`;
        }
        context += '\n';

        if (node.content) {
          context += `${indent}  Content:\n`;
          const lines = node.content.split('\n').slice(0, 50); // Limit to first 50 lines
          lines.forEach((line) => {
            context += `${indent}    ${line}\n`;
          });
          if (node.content.split('\n').length > 50) {
            context += `${indent}    ... (truncated)\n`;
          }
        } else if (node.error) {
          context += `${indent}  Error: ${node.error}\n`;
        }
      }
    };

    addNode(tree);
    return context;
  }

  static getFileCount(tree: FileSystemNode): string {
    let fileCount = 0;
    let dirCount = 0;

    const count = (node: FileSystemNode): void => {
      if (node.is_dir) {
        dirCount++;
        if (node.children) {
          node.children.forEach(count);
        }
      } else {
        fileCount++;
      }
    };

    count(tree);
    return `${fileCount} files, ${dirCount} directories`;
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
