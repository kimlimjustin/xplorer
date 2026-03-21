import { useState, useCallback, useEffect, useRef } from 'react';
import { AIService, type FileContext, type ChatMessage } from '@/lib/ai-service';
import {
  TauriAPI,
  type FileEntry,
  type ChatSession,
  type ChatSessionSummary,
} from '@/lib/tauri-api';

// ── Types ────────────────────────────────────────────────────────────────────

interface UseChatDeps {
  selectedFile: FileEntry | null;
  toast: (opts: {
    title?: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }) => void;
}

const MAX_CHAT_MESSAGES = 100;
const AUTO_SAVE_DELAY = 2000; // debounce auto-save by 2s

const formatError = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

/** Generate a short unique ID */
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
};

/** Derive a session title from the first user message */
const deriveTitle = (messages: ChatMessage[]): string => {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return 'New Chat';
  const text = first.content.trim();
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export const useChat = (deps: UseChatDeps) => {
  const { selectedFile, toast } = deps;

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Session management
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);

  // Refs for auto-save debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef(chatMessages);
  messagesRef.current = chatMessages;
  const sessionIdRef = useRef(currentSessionId);
  sessionIdRef.current = currentSessionId;

  // ── Load session list on mount ───────────────────────────────────────────
  useEffect(() => {
    TauriAPI.getChatSessions()
      .then((list: ChatSessionSummary[]) => setSessions(list))
      .catch((err) => console.warn('[Chat] Failed to load sessions:', err));
  }, []);

  // ── Auto-save current session on message changes ─────────────────────────
  const saveCurrentSession = useCallback(async () => {
    const msgs = messagesRef.current;
    const sid = sessionIdRef.current;
    if (msgs.length === 0) return;

    const sessionId = sid || generateId();
    if (!sid) {
      setCurrentSessionId(sessionId);
      sessionIdRef.current = sessionId;
    }

    const session: ChatSession = {
      id: sessionId,
      title: deriveTitle(msgs),
      messages: msgs.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp || 0,
      })),
      created_at: '',
      updated_at: '',
    };

    try {
      await TauriAPI.saveChatSession(session);
      // Refresh session list
      const list = await TauriAPI.getChatSessions();
      setSessions(list);
    } catch {
      // Silently fail — auto-save is best effort
    }
  }, []);

  // Debounced auto-save whenever messages change
  useEffect(() => {
    if (chatMessages.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveCurrentSession();
    }, AUTO_SAVE_DELAY);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [chatMessages, saveCurrentSession]);

  // ── Core message operations ──────────────────────────────────────────────

  const addChatMessage = useCallback((message: ChatMessage) => {
    setChatMessages((prev) => {
      const next = [...prev, message];
      return next.length > MAX_CHAT_MESSAGES ? next.slice(-MAX_CHAT_MESSAGES) : next;
    });
  }, []);

  const sendChatMessage = useCallback(
    async (model?: string, fileContext?: FileContext) => {
      if (!chatInput.trim() || isAiLoading) return;
      const userMessage: ChatMessage = { role: 'user', content: chatInput, timestamp: Date.now() };
      setChatMessages((prev) => {
        const next = [...prev, userMessage];
        return next.length > MAX_CHAT_MESSAGES ? next.slice(-MAX_CHAT_MESSAGES) : next;
      });
      setChatInput('');
      setIsAiLoading(true);
      try {
        let contextToUse = fileContext;
        if (!contextToUse && selectedFile && !selectedFile.is_dir) {
          contextToUse = {
            name: selectedFile.name,
            path: selectedFile.path,
            file_type: selectedFile.file_type,
          };
        }
        const response = await AIService.chatWithAI(
          model || 'deepseek-r1:1.5b',
          chatMessages.concat(userMessage),
          contextToUse,
        );
        const aiResponse: ChatMessage = {
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
          model: model || 'deepseek-r1:1.5b',
        };
        setChatMessages((prev) => {
          const next = [...prev, aiResponse];
          return next.length > MAX_CHAT_MESSAGES ? next.slice(-MAX_CHAT_MESSAGES) : next;
        });
        toast({ title: 'AI Response', description: 'Successfully received AI response' });
      } catch (error) {
        console.error('Failed to get AI response:', error);
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${(error as Error).message}. Please make sure Ollama is running and the DeepSeek models are installed.`,
        };
        setChatMessages((prev) => {
          const next = [...prev, errorMessage];
          return next.length > MAX_CHAT_MESSAGES ? next.slice(-MAX_CHAT_MESSAGES) : next;
        });
        toast({
          variant: 'destructive',
          title: 'AI Error',
          description: `Failed to get AI response: ${formatError(error)}`,
        });
      } finally {
        setIsAiLoading(false);
      }
    },
    [chatInput, isAiLoading, chatMessages, selectedFile, toast],
  );

  // ── Session operations ─────────────────────────────────────────────────

  /** Start a new empty chat session */
  const newSession = useCallback(() => {
    // Save current session first if it has messages
    if (messagesRef.current.length > 0) {
      saveCurrentSession();
    }
    setChatMessages([]);
    setCurrentSessionId(null);
    sessionIdRef.current = null;
  }, [saveCurrentSession]);

  /** Load a previous session */
  const loadSession = useCallback(
    async (sessionId: string) => {
      try {
        const session = await TauriAPI.getChatSession(sessionId);
        if (!session) return;
        const msgs: ChatMessage[] = session.messages.map(
          (m: { role: string; content: string; timestamp: number }) => ({
            role: m.role as ChatMessage['role'],
            content: m.content,
            timestamp: m.timestamp,
          }),
        );
        setChatMessages(msgs);
        setCurrentSessionId(sessionId);
        sessionIdRef.current = sessionId;
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `Failed to load session: ${formatError(error)}`,
        });
      }
    },
    [toast],
  );

  /** Delete a session */
  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await TauriAPI.deleteChatSession(sessionId);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        // If we deleted the active session, clear messages
        if (sessionIdRef.current === sessionId) {
          setChatMessages([]);
          setCurrentSessionId(null);
          sessionIdRef.current = null;
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `Failed to delete session: ${formatError(error)}`,
        });
      }
    },
    [toast],
  );

  /** Clear all history */
  const clearAllHistory = useCallback(async () => {
    try {
      await TauriAPI.clearChatHistory();
      setSessions([]);
      setChatMessages([]);
      setCurrentSessionId(null);
      sessionIdRef.current = null;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to clear history: ${formatError(error)}`,
      });
    }
  }, [toast]);

  return {
    chatMessages,
    chatInput,
    setChatInput,
    isAiLoading,
    addChatMessage,
    sendChatMessage,
    // Session management
    sessions,
    currentSessionId,
    newSession,
    loadSession,
    deleteSession,
    clearAllHistory,
  };
};
