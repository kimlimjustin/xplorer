import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TauriAPI, type RecentFile } from '@/lib/tauri-api';
import { AgentService, type AgentEvent, type AgentToolCall } from '@/lib/agent-service';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { formatFileSize, applyTheme } from '@/lib/utils';
import { isWindows, ROOT_PATH, PATH_SEPARATOR } from '@/lib/constants';
import { useAllThemes } from '@/lib/theme-registry';
import { useToast } from '@/hooks/use-toast';
import { CLOCK_UPDATE_INTERVAL_MS } from '@/lib/constants';

interface QuickStats {
  totalFiles: number;
  totalFolders: number;
  totalSize: string;
  recentFiles: string[];
}

interface UserDirectories {
  home: string;
  documents: string;
  downloads: string;
  desktop: string;
  pictures: string;
  videos: string;
  music: string;
}

interface HomePageProps {
  onNavigate: (path: string) => void;
  theme: string;
  setTheme: (theme: string) => void;
}

// Solid SVG Icon components — filled style for crisp rendering at small sizes
const FolderIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
  </svg>
);

const DocumentIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z"
      clipRule="evenodd"
    />
    <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
  </svg>
);

const DownloadIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z"
      clipRule="evenodd"
    />
  </svg>
);

const DesktopIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M2.25 5.25a3 3 0 013-3h13.5a3 3 0 013 3V15a3 3 0 01-3 3h-3v.257c0 .597.237 1.17.659 1.591l.621.622a.75.75 0 01-.53 1.28h-9a.75.75 0 01-.53-1.28l.621-.622a2.25 2.25 0 00.659-1.59V18h-3a3 3 0 01-3-3V5.25zm1.5 0v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5z"
      clipRule="evenodd"
    />
  </svg>
);

const PhotoIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z"
      clipRule="evenodd"
    />
  </svg>
);

const VideoIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.689V7.939l2.69-2.689c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" />
  </svg>
);

const MusicIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M19.952 1.651a.75.75 0 01.298.599V16.303a3 3 0 01-2.176 2.884l-1.32.377a2.553 2.553 0 11-1.403-4.909l2.311-.66a1.5 1.5 0 001.088-1.442V6.994l-9 2.572v9.737a3 3 0 01-2.176 2.884l-1.32.377a2.553 2.553 0 11-1.402-4.909l2.31-.66a1.5 1.5 0 001.088-1.442V5.25a.75.75 0 01.544-.721l10.5-3a.75.75 0 01.706.122z"
      clipRule="evenodd"
    />
  </svg>
);

const TrashIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z"
      clipRule="evenodd"
    />
  </svg>
);

const _SearchIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z"
      clipRule="evenodd"
    />
  </svg>
);

const _TerminalIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M2.25 6a3 3 0 013-3h13.5a3 3 0 013 3v12a3 3 0 01-3 3H5.25a3 3 0 01-3-3V6zm3.97 1.28a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 01-1.06-1.06l2.47-2.47-2.47-2.47a.75.75 0 010-1.06zm4.28 4.97a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z"
      clipRule="evenodd"
    />
  </svg>
);

const SparklesIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z"
      clipRule="evenodd"
    />
  </svg>
);

const _ServerIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M4.08 5.227A3 3 0 016.979 3h10.042a3 3 0 012.899 2.227l2.747 10.11A6.017 6.017 0 0019.5 15H4.5c-1.16 0-2.24.329-3.157.338L4.08 5.227z" />
    <path
      fillRule="evenodd"
      d="M1.5 16.5A3 3 0 014.5 13.5h15a3 3 0 013 3v.75a3 3 0 01-3 3h-15a3 3 0 01-3-3v-.75zm15.75 0a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"
      clipRule="evenodd"
    />
  </svg>
);

const DriveIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M2.25 13.5a8.25 8.25 0 0119.5 0v.75a.75.75 0 01-.75.75H3a.75.75 0 01-.75-.75v-.75zm9-5.25a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H12a.75.75 0 01-.75-.75V8.25zM12 12a.75.75 0 100 1.5.75.75 0 000-1.5z"
      clipRule="evenodd"
    />
    <path d="M2.25 16.5a.75.75 0 01.75-.75h18a.75.75 0 01.75.75v2.25a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V16.5zm15.75.75a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
  </svg>
);

const _ArrowRightIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
      clipRule="evenodd"
    />
  </svg>
);

const ClockIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z"
      clipRule="evenodd"
    />
  </svg>
);

const _CheckCircleIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      fillRule="evenodd"
      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
      clipRule="evenodd"
    />
  </svg>
);

/** Returns a human-readable relative time string. */
const relativeTime = (timestampMs: number) : string => {
  const now = Date.now();
  const diff = now - timestampMs;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/** Icon gradient based on file type. */
const recentFileGradient = (fileType: string) : string => {
  const t = fileType.toLowerCase();
  if (t === 'folder') return 'from-amber-500 to-amber-600';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(t))
    return 'from-pink-500 to-pink-600';
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm'].includes(t))
    return 'from-orange-500 to-orange-600';
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'wma'].includes(t)) return 'from-cyan-500 to-cyan-600';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(t))
    return 'from-yellow-500 to-yellow-600';
  if (
    [
      'js',
      'ts',
      'jsx',
      'tsx',
      'py',
      'rs',
      'go',
      'java',
      'c',
      'cpp',
      'html',
      'css',
      'json',
      'yaml',
      'toml',
      'xml',
    ].includes(t)
  )
    return 'from-emerald-500 to-emerald-600';
  if (['txt', 'md', 'rtf', 'doc', 'docx', 'pdf', 'csv', 'log'].includes(t))
    return 'from-blue-500 to-blue-600';
  return 'from-slate-500 to-slate-600';
}

/** Simple SVG icon for recent files based on type. */
const RecentFileTypeIcon = ({
  fileType,
  className = 'w-3.5 h-3.5',
}: {
  fileType: string;
  className?: string;
}) => {
  const t = fileType.toLowerCase();
  if (t === 'folder') return <FolderIcon className={className} />;
  return <DocumentIcon className={className} />;
}

const HomePage = ({ onNavigate, theme: _theme, setTheme }: HomePageProps) => {
  const themes = useAllThemes();
  const { toast } = useToast();
  const [recommendedFolders, setRecommendedFolders] = useState<string[]>([]);
  const [userDirectories, setUserDirectories] = useState<UserDirectories | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [_quickStats, setQuickStats] = useState<QuickStats>({
    totalFiles: 0,
    totalFolders: 0,
    totalSize: '0 B',
    recentFiles: [],
  });
  const [_systemStats, setSystemStats] = useState<{
    os: string;
    arch: string;
    version: string;
    hostname: string;
  } | null>(null);

  // Recent files state
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [recentFilesLoading, setRecentFilesLoading] = useState(true);

  const loadRecentFiles = useCallback(async () => {
    setRecentFilesLoading(true);
    try {
      const files = await TauriAPI.getRecentFiles(12);
      setRecentFiles(files);
    } catch (err) {
      console.error('Failed to load recent files:', err);
    } finally {
      setRecentFilesLoading(false);
    }
  }, []);

  const handleClearRecentFiles = async () => {
    try {
      await TauriAPI.clearRecentFiles();
      setRecentFiles([]);
    } catch (err) {
      console.error('Failed to clear recent files:', err);
    }
  };

  const handleRemoveRecentFile = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    try {
      await TauriAPI.removeRecentFile(path);
      setRecentFiles((prev) => prev.filter((f) => f.path !== path));
    } catch (err) {
      console.error('Failed to remove recent file:', err);
    }
  };

  const handleRecentFileClick = (file: RecentFile) => {
    if (file.file_type === 'folder') {
      handleNavigate(file.path);
    } else {
      // Navigate to the parent directory
      const sep = file.path.includes('/') ? '/' : '\\';
      const parts = file.path.split(sep);
      parts.pop();
      const parentDir = parts.join(sep);
      if (parentDir) {
        handleNavigate(parentDir);
      }
    }
  };

  // AI Assistant state
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<
    Array<{ role: 'user' | 'assistant'; content: string }>
  >([]);
  const [aiStreaming, setAiStreaming] = useState('');
  const [aiRunning, setAiRunning] = useState(false);
  const [aiToolCalls, setAiToolCalls] = useState<
    Array<{ id: string; name: string; status: string }>
  >([]);
  const [aiPendingApprovals, setAiPendingApprovals] = useState<AgentToolCall[]>([]);
  const aiScrollRef = useRef<HTMLDivElement>(null);

  const scrollAiToBottom = () => {
    if (aiScrollRef.current) {
      aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
    }
  };

  useEffect(scrollAiToBottom, [aiMessages, aiStreaming, aiToolCalls]);

  const handleAiSend = async () => {
    const msg = aiInput.trim();
    if (!msg || aiRunning) return;
    setAiInput('');

    const userMsg = { role: 'user' as const, content: msg };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiRunning(true);
    setAiStreaming('');
    setAiToolCalls([]);
    setAiPendingApprovals([]);

    let streamBuf = '';
    const conversationForApi = [...aiMessages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      await AgentService.startAgentChat(
        conversationForApi,
        userDirectories?.home || ROOT_PATH,
        (event: AgentEvent) => {
          switch (event.event_type) {
            case 'text':
            case 'text_delta':
              if (event.text) {
                streamBuf += event.text;
                setAiStreaming(streamBuf);
              }
              break;
            case 'tool_call':
              if (event.tool_call) {
                setAiToolCalls((prev) => [
                  ...prev,
                  {
                    id: event.tool_call!.id,
                    name: event.tool_call!.name,
                    status: event.tool_call!.status,
                  },
                ]);
              }
              break;
            case 'approval_request':
              if (event.tool_call) {
                setAiPendingApprovals((prev) => [...prev, event.tool_call!]);
              }
              break;
            case 'tool_result':
              if (event.tool_call) {
                setAiToolCalls((prev) =>
                  prev.map((tc) =>
                    tc.id === event.tool_call!.id ? { ...tc, status: event.tool_call!.status } : tc,
                  ),
                );
                setAiPendingApprovals((prev) => prev.filter((tc) => tc.id !== event.tool_call!.id));
              }
              break;
            case 'complete':
              if (streamBuf) {
                setAiMessages((prev) => [...prev, { role: 'assistant', content: streamBuf }]);
                setAiStreaming('');
                streamBuf = '';
              }
              setAiRunning(false);
              setAiToolCalls([]);
              break;
            case 'error':
              if (streamBuf) {
                setAiMessages((prev) => [...prev, { role: 'assistant', content: streamBuf }]);
              }
              setAiMessages((prev) => [
                ...prev,
                { role: 'assistant', content: `Error: ${event.text || 'Unknown error'}` },
              ]);
              setAiStreaming('');
              setAiRunning(false);
              break;
          }
        },
      );
    } catch (err) {
      setAiMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Failed to start agent: ${err}` },
      ]);
      setAiRunning(false);
    }
  };

  const handleApproval = async (toolCallId: string, response: string) => {
    try {
      await AgentService.respondToApproval(toolCallId, response);
      setAiPendingApprovals((prev) => prev.filter((tc) => tc.id !== toolCallId));
    } catch (err) {
      console.error('Approval failed:', err);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), CLOCK_UPDATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadUserData();
    loadSystemStats();
    loadRecentFiles();
    // Mount-only initialization
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserData = async () => {
    try {
      const userDirs = await TauriAPI.getUserDirectories();
      setUserDirectories(userDirs);

      const recent = await TauriAPI.getRecentFolders();
      setRecommendedFolders(recent.slice(0, 4));

      const homeExists = await TauriAPI.fileExists(userDirs.home);
      if (homeExists) {
        const files = await TauriAPI.readDirectory(userDirs.home);
        const totalFiles = files.filter((f) => !f.is_dir).length;
        const totalFolders = files.filter((f) => f.is_dir).length;
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        setQuickStats({
          totalFiles,
          totalFolders,
          totalSize: formatFileSize(totalSize),
          recentFiles: [],
        });
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
      const home = isWindows ? 'C:\\Users\\Public' : '/home/user';
      setUserDirectories({
        home,
        documents: home + PATH_SEPARATOR + 'Documents',
        downloads: home + PATH_SEPARATOR + 'Downloads',
        desktop: home + PATH_SEPARATOR + 'Desktop',
        pictures: home + PATH_SEPARATOR + 'Pictures',
        videos: home + PATH_SEPARATOR + 'Videos',
        music: home + PATH_SEPARATOR + 'Music',
      });
    }
  };

  const loadSystemStats = async () => {
    try {
      const systemInfo = await TauriAPI.getSystemInfo();
      setSystemStats(systemInfo);
    } catch (error) {
      console.error('Failed to load system stats:', error);
    }
  };

  const handleNavigate = async (path: string) => {
    await TauriAPI.addToRecentFolders(path);
    onNavigate(path);
  };

  const _handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    const themeData = themes[newTheme as keyof typeof themes];
    toast({
      title: 'Theme Changed',
      description: `Applied ${themeData?.name || newTheme} theme`,
    });
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const quickAccessFolders = userDirectories
    ? [
        {
          name: 'Documents',
          path: userDirectories.documents,
          icon: DocumentIcon,
          gradient: 'from-blue-500 to-blue-600',
        },
        {
          name: 'Downloads',
          path: userDirectories.downloads,
          icon: DownloadIcon,
          gradient: 'from-emerald-500 to-emerald-600',
        },
        {
          name: 'Desktop',
          path: userDirectories.desktop,
          icon: DesktopIcon,
          gradient: 'from-violet-500 to-violet-600',
        },
        {
          name: 'Pictures',
          path: userDirectories.pictures,
          icon: PhotoIcon,
          gradient: 'from-pink-500 to-pink-600',
        },
        {
          name: 'Videos',
          path: userDirectories.videos,
          icon: VideoIcon,
          gradient: 'from-orange-500 to-orange-600',
        },
        {
          name: 'Music',
          path: userDirectories.music,
          icon: MusicIcon,
          gradient: 'from-cyan-500 to-cyan-600',
        },
      ]
    : [];

  return (
    <div className="h-full bg-xp-bg text-xp-text overflow-auto flex flex-col">
      <div className="max-w-5xl mx-auto px-6 py-8 w-full flex flex-col flex-1 min-h-0">
        {/* Hero / Greeting */}
        <div className="mb-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-xp-text-muted mb-1 flex items-center gap-1.5">
                <ClockIcon />
                {currentTime.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <h1 className="text-3xl font-bold text-xp-text">{getGreeting()}</h1>
            </div>
            <p className="text-2xl font-light text-xp-text-muted tabular-nums">
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {quickAccessFolders.map((folder) => {
              const Icon = folder.icon;
              return (
                <button
                  key={folder.name}
                  onClick={() => handleNavigate(folder.path)}
                  className="group flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-xp-surface/50 border border-xp-border hover:border-xp-text-muted hover:bg-xp-surface transition-all duration-150"
                >
                  <div
                    className={`w-7 h-7 rounded-md bg-gradient-to-br ${folder.gradient} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm font-medium text-xp-text">{folder.name}</span>
                </button>
              );
            })}
            <button
              onClick={() => handleNavigate('xplorer://trash')}
              className="group flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-xp-surface/50 border border-xp-border hover:border-xp-text-muted hover:bg-xp-surface transition-all duration-150"
            >
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center flex-shrink-0">
                <TrashIcon className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium text-xp-text">Trash</span>
            </button>
            <button
              onClick={() => handleNavigate(ROOT_PATH)}
              className="group flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-xp-surface/50 border border-xp-border hover:border-xp-text-muted hover:bg-xp-surface transition-all duration-150"
            >
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center flex-shrink-0">
                <DriveIcon className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium text-xp-text">
                {isWindows ? 'C:' : 'Macintosh HD'}
              </span>
            </button>
          </div>

          {/* Recent folders inline */}
          {recommendedFolders.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {recommendedFolders.map((path, index) => {
                const name = path.split(/[\\/]/).pop() || path;
                return (
                  <button
                    key={index}
                    onClick={() => handleNavigate(path)}
                    className="group flex items-center gap-2 px-3 py-1.5 rounded-md bg-xp-bg/40 border border-xp-border hover:border-xp-text-muted transition-colors text-xs"
                    title={path}
                  >
                    <FolderIcon className="w-3 h-3 text-xp-blue flex-shrink-0" />
                    <span className="text-xp-text-muted group-hover:text-xp-text truncate max-w-[140px]">
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Files */}
        {!recentFilesLoading && recentFiles.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <ClockIcon />
                <span className="text-sm font-medium text-xp-text">Recent Files</span>
              </div>
              <button
                onClick={handleClearRecentFiles}
                className="text-[11px] text-xp-text-muted hover:text-xp-error transition-colors"
              >
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {recentFiles.map((file) => {
                const gradient = recentFileGradient(file.file_type);
                return (
                  <div
                    key={`${file.path}-${file.accessed_at}`}
                    onClick={() => handleRecentFileClick(file)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRecentFileClick(file); } }}
                    role="button"
                    tabIndex={0}
                    className="group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-xp-surface/50 border border-xp-border hover:border-xp-text-muted hover:bg-xp-surface transition-all duration-150 text-left cursor-pointer"
                    title={file.path}
                  >
                    <div
                      className={`w-7 h-7 rounded-md bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}
                    >
                      <RecentFileTypeIcon
                        fileType={file.file_type}
                        className="w-3.5 h-3.5 text-white"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-xp-text truncate">{file.name}</p>
                      <p className="text-[10px] text-xp-text-muted">
                        {relativeTime(file.accessed_at)}
                      </p>
                    </div>
                    {/* Remove button on hover */}
                    <button
                      onClick={(e) => handleRemoveRecentFile(e, file.path)}
                      className="absolute top-1 right-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-xp-error/20 text-xp-text-muted hover:text-xp-error transition-all"
                      title="Remove from recent"
                    >
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Assistant - takes remaining space */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="bg-xp-surface/50 border border-xp-border rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
            {/* Chat messages area */}
            <div ref={aiScrollRef} className="flex-1 overflow-y-auto px-5 pt-4 pb-2 min-h-0">
              {aiMessages.length === 0 && !aiStreaming && (
                <div className="h-full flex flex-col items-center justify-center text-center py-12">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-4">
                    <SparklesIcon className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm text-xp-text mb-1">Xplorer Agent</p>
                  <p className="text-xs text-xp-text-muted max-w-xs">
                    Ask me to organize files, find documents, run commands, or manage your
                    workspace.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {aiMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm ${
                        msg.role === 'user'
                          ? 'bg-xp-blue/20 text-xp-text'
                          : 'bg-xp-bg/60 text-xp-text'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <span>{msg.content}</span>
                      ) : (
                        <MarkdownRenderer content={msg.content} />
                      )}
                    </div>
                  </div>
                ))}

                {/* Streaming response */}
                {aiStreaming && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm bg-xp-bg/60 text-xp-text">
                      <MarkdownRenderer content={aiStreaming} />
                    </div>
                  </div>
                )}

                {/* Tool calls */}
                {aiToolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {aiToolCalls.map((tc) => (
                      <span
                        key={tc.id}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-xp-bg/60 border border-xp-border text-xp-text-muted"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            tc.status === 'completed'
                              ? 'bg-green-400'
                              : tc.status === 'error' || tc.status === 'denied'
                                ? 'bg-red-400'
                                : 'bg-blue-400 animate-pulse'
                          }`}
                        />
                        {tc.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Approval requests */}
                {aiPendingApprovals.map((tc) => (
                  <div
                    key={tc.id}
                    className="p-3 rounded-lg border border-yellow-500/40 bg-yellow-500/5"
                  >
                    <p className="text-xs text-yellow-400 font-medium mb-1.5">Approve: {tc.name}</p>
                    <p className="text-xs text-xp-text-muted mb-2 font-mono truncate">
                      {tc.name === 'execute_command'
                        ? String((tc.input as Record<string, unknown>)?.command || '')
                        : tc.name === 'write_file' || tc.name === 'delete'
                          ? String((tc.input as Record<string, unknown>)?.path || '')
                          : JSON.stringify(tc.input).slice(0, 80)}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproval(tc.id, 'allow_once')}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-500 transition-colors"
                      >
                        This Time
                      </button>
                      <button
                        onClick={() => handleApproval(tc.id, 'allow_always')}
                        className="px-3 py-1 text-xs bg-xp-blue text-white rounded hover:opacity-80 transition-colors"
                      >
                        Always
                      </button>
                      <button
                        onClick={() => handleApproval(tc.id, 'deny_always')}
                        className="px-3 py-1 text-xs bg-xp-surface border border-xp-border text-xp-text rounded hover:bg-xp-bg transition-colors"
                      >
                        Never
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Input area - pinned at bottom */}
            <div className="border-t border-xp-border p-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAiSend();
                      }
                    }}
                    placeholder="Ask anything..."
                    disabled={aiRunning}
                    className="w-full bg-xp-bg/60 border border-xp-border rounded-lg pl-4 pr-20 py-2.5 text-sm text-xp-text placeholder-xp-text-muted focus:outline-none focus:border-xp-blue/50 focus:ring-1 focus:ring-xp-blue/30 disabled:opacity-50 transition-colors"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {aiRunning ? (
                      <button
                        onClick={() => AgentService.cancelSession()}
                        className="px-2.5 py-1 text-xs bg-xp-error/20 text-xp-error rounded-md hover:bg-xp-error/30 transition-colors"
                      >
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={handleAiSend}
                        disabled={!aiInput.trim()}
                        className="px-2.5 py-1 text-xs bg-xp-blue/20 text-xp-blue rounded-md hover:bg-xp-blue/30 disabled:opacity-30 transition-colors"
                      >
                        Send
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {aiMessages.length === 0 && (
                <div className="flex gap-2 mt-2.5">
                  {[
                    'List my recent files',
                    'Organize my Downloads',
                    'What large files do I have?',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setAiInput(suggestion);
                      }}
                      className="px-2.5 py-1 text-xs rounded-md bg-xp-bg/40 border border-xp-border text-xp-text-muted hover:text-xp-text hover:border-xp-text-muted transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
