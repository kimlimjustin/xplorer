interface ChatSessionSummaryItem {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

interface ChatSessionSidebarProps {
  sessions: ChatSessionSummaryItem[];
  currentSessionId?: string | null;
  onLoadSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onClearHistory?: () => void;
  onClose: () => void;
}

const formatSessionDate = (iso: string): string => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return '';
  }
};

const ChatSessionSidebar = ({
  sessions,
  currentSessionId,
  onLoadSession,
  onDeleteSession,
  onClearHistory,
  onClose,
}: ChatSessionSidebarProps) => {
  return (
    <div
      style={{ flex: '1 1 0%', minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'hidden' }}
    >
      <div className="border-xp-border flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium">Chat History ({sessions.length})</span>
        {onClearHistory && sessions.length > 0 && (
          <button
            onClick={() => {
              onClearHistory();
              onClose();
            }}
            className="text-xp-red text-[10px] hover:underline"
          >
            Clear all
          </button>
        )}
      </div>
      <div className="space-y-0.5">
        {sessions.length === 0 ? (
          <div className="text-xp-text-muted px-3 py-6 text-center text-xs">No saved chats</div>
        ) : (
          [...sessions]
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .map((session) => (
              <div
                key={session.id}
                className={`hover:bg-xp-bg-hover group flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors ${
                  currentSessionId === session.id ? 'bg-xp-blue/10 border-xp-blue border-l-2' : ''
                }`}
                onClick={() => {
                  onLoadSession?.(session.id);
                  onClose();
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{session.title}</div>
                  <div className="text-xp-text-muted flex items-center gap-2 text-[10px]">
                    <span>{session.message_count} messages</span>
                    <span>{formatSessionDate(session.updated_at)}</span>
                  </div>
                </div>
                {onDeleteSession && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="text-xp-text-muted hover:text-xp-red p-1 opacity-0 transition-all group-hover:opacity-100"
                    title="Delete session"
                  >
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export type { ChatSessionSummaryItem };

export default ChatSessionSidebar;
