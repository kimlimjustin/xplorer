// Mock AgentService for web landing page demos

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
  model: string;
  max_turns: number;
  auto_approve: boolean;
  thinking_enabled?: boolean;
}

export class AgentService {
  static generateSessionId(): string {
    return `agent_${Date.now()}_demo`;
  }

  static async startAgentChat(
    _messages: Array<{ role: string; content: string }>,
    _currentPath: string,
    _onEvent: (event: AgentEvent) => void,
    _filesystemContext?: string,
    _model?: string,
  ): Promise<string> {
    return this.generateSessionId();
  }

  static async respondToApproval(_toolCallId: string, _response: string | boolean): Promise<void> {}

  static async cancelSession(): Promise<void> {}

  static async getSettings(): Promise<AgentSettings> {
    return {
      enabled: true,
      api_key: '',
      model: 'claude-sonnet-4-6',
      max_turns: 10,
      auto_approve: false,
    };
  }

  static async updateSettings(_settings: AgentSettings): Promise<void> {}

  static async approvePlan(_planId: string): Promise<void> {}

  static async getPlan(_planId: string): Promise<OperationPlan | null> {
    return null;
  }

  static async getMemories(): Promise<MemoryEntry[]> {
    return [];
  }

  static async clearMemory(): Promise<void> {}

  static async deleteMemory(_key: string): Promise<void> {}

  static isRunning(): boolean {
    return false;
  }
}
