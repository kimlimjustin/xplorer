import { transport, listenToEvent } from './transport';
type UnlistenFn = () => void;

export interface AgentToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  requires_approval: boolean;
  status: 'pending' | 'running' | 'completed' | 'denied' | 'error';
  result?: string;
  error?: string;
}

export interface PlanStep {
  action: string;
  description: string;
  params: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: string;
  error?: string;
}

export interface OperationPlan {
  id: string;
  title: string;
  description?: string;
  steps: PlanStep[];
  status: 'pending_approval' | 'approved' | 'executing' | 'completed' | 'failed' | 'cancelled';
  created_at: number;
  completed_at?: number;
  completed_steps: number;
  total_steps: number;
}

export interface MemoryEntry {
  key: string;
  value: string;
  category: 'preference' | 'knowledge' | 'context';
  created_at: number;
  updated_at: number;
  access_count: number;
}

export interface AgentEvent {
  event_type:
    | 'text'
    | 'text_delta'
    | 'thinking_delta'
    | 'tool_call'
    | 'tool_result'
    | 'approval_request'
    | 'plan_created'
    | 'plan_progress'
    | 'complete'
    | 'error';
  session_id: string;
  tool_call?: AgentToolCall;
  text?: string;
  plan?: OperationPlan;
  timestamp: number;
}

export interface AgentSettings {
  enabled: boolean;
  api_key: string;
  openai_api_key: string;
  model: string;
  max_turns: number;
  auto_approve: boolean;
  thinking_enabled: boolean;
  thinking_budget: number;
}

export interface AgentPermissions {
  disabled_tools: string[];
  auto_approve_tools: string[];
  allowed_paths: string[];
  blocked_paths: string[];
  custom_blocked_commands: string[];
  block_internet: boolean;
}

type AgentEventCallback = (event: AgentEvent) => void;

export class AgentService {
  private static unlistenFn: UnlistenFn | null = null;
  private static currentSessionId: string | null = null;

  static generateSessionId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  static async startAgentChat(
    messages: Array<{ role: string; content: string }>,
    currentPath: string,
    onEvent: AgentEventCallback,
    filesystemContext?: string,
    model?: string,
  ): Promise<string> {
    const sessionId = this.generateSessionId();
    this.currentSessionId = sessionId;

    // Clean up any existing listener
    if (this.unlistenFn) {
      this.unlistenFn();
      this.unlistenFn = null;
    }

    // Subscribe to agent events
    this.unlistenFn = await listenToEvent<AgentEvent>('agent-event', (agentEvent) => {
      if (agentEvent.session_id === sessionId) {
        onEvent(agentEvent);

        // Clean up listener on complete or error
        if (agentEvent.event_type === 'complete' || agentEvent.event_type === 'error') {
          if (this.unlistenFn) {
            this.unlistenFn();
            this.unlistenFn = null;
          }
          this.currentSessionId = null;
        }
      }
    });

    // Convert messages to the format expected by the backend (JSON Values)
    const apiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Fire-and-forget the async agent loop; events stream via Tauri events
    transport('agent_chat', {
      sessionId,
      messages: apiMessages,
      currentPath,
      filesystemContext: filesystemContext || null,
      model: model || null,
    }).catch((err) => {
      onEvent({
        event_type: 'error',
        session_id: sessionId,
        text: String(err),
        timestamp: Date.now(),
      });
      if (this.unlistenFn) {
        this.unlistenFn();
        this.unlistenFn = null;
      }
      this.currentSessionId = null;
    });

    return sessionId;
  }

  static async respondToApproval(toolCallId: string, response: string): Promise<void> {
    await transport('agent_respond_approval', { toolCallId, response });
  }

  static async cancelSession(): Promise<void> {
    if (this.currentSessionId) {
      await transport('agent_cancel_session', { sessionId: this.currentSessionId });
      this.currentSessionId = null;
    }
    if (this.unlistenFn) {
      this.unlistenFn();
      this.unlistenFn = null;
    }
  }

  static async getSettings(): Promise<AgentSettings> {
    try {
      return await transport('get_agent_settings');
    } catch {
      return {
        enabled: false,
        api_key: '',
        openai_api_key: '',
        model: 'llama3.2',
        max_turns: 10,
        auto_approve: false,
        thinking_enabled: false,
        thinking_budget: 10000,
      };
    }
  }

  static async updateSettings(settings: AgentSettings): Promise<void> {
    try {
      await transport('update_agent_settings', { settings });
    } catch {
      throw new Error('Failed to update AI settings');
    }
  }

  // Plan operations
  static async approvePlan(planId: string): Promise<void> {
    try {
      await transport('agent_approve_plan', { planId });
    } catch {
      throw new Error('Failed to approve plan');
    }
  }

  static async getPlan(planId: string): Promise<OperationPlan | null> {
    try {
      return await transport('agent_get_plan', { planId });
    } catch {
      return null;
    }
  }

  // Memory operations
  static async getMemories(): Promise<MemoryEntry[]> {
    try {
      return await transport('get_agent_memory');
    } catch {
      return [];
    }
  }

  static async clearMemory(): Promise<void> {
    try {
      await transport('clear_agent_memory');
    } catch {
      throw new Error('Failed to clear memory');
    }
  }

  static async deleteMemory(key: string): Promise<void> {
    try {
      await transport('delete_agent_memory', { key });
    } catch {
      throw new Error('Failed to delete memory');
    }
  }

  // Permissions operations
  static async getPermissions(): Promise<AgentPermissions> {
    try {
      return await transport('get_agent_permissions');
    } catch {
      return {
        disabled_tools: [],
        auto_approve_tools: [],
        allowed_paths: [],
        blocked_paths: [],
        custom_blocked_commands: [],
        block_internet: true,
      };
    }
  }

  static async updatePermissions(permissions: AgentPermissions): Promise<void> {
    await transport('update_agent_permissions', { permissions });
  }

  static isRunning(): boolean {
    return this.currentSessionId !== null;
  }
}
