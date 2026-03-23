import React from 'react';
import type { SearchResult, RecentFile } from '@/lib/tauri-api';
import { STORAGE_KEYS } from '@/lib/storage-keys';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Command {
  id: string;
  title: string;
  shortcut?: string;
  icon?: React.ReactNode;
  category?: string;
  action: () => void;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
  onFileSelect?: (filePath: string, isDir: boolean) => void;
  currentPath?: string;
}

export interface HistoryEntry {
  commandId: string;
  title: string;
  timestamp: number;
}

export type PaletteItem =
  | { type: 'command'; command: Command; matchIndices: number[]; sectionLabel?: string }
  | { type: 'recent-file'; file: RecentFile; sectionLabel?: string };

export type VirtualRow =
  | { kind: 'section-header'; label: string }
  | { kind: 'command'; command: Command; matchIndices: number[]; itemIndex: number }
  | { kind: 'recent-file'; file: RecentFile; itemIndex: number }
  | { kind: 'search-file'; result: SearchResult; itemIndex: number }
  | { kind: 'loading' };

// ── Constants ────────────────────────────────────────────────────────────────

export const HISTORY_KEY = STORAGE_KEYS.COMMAND_HISTORY;
export const FAVORITES_KEY = STORAGE_KEYS.COMMAND_FAVORITES;
export const MAX_HISTORY = 20;

export const COMMAND_ROW_HEIGHT = 40;
export const FILE_ROW_HEIGHT = 50;
export const SECTION_HEADER_HEIGHT = 28;
export const LOADING_ROW_HEIGHT = 36;

// ── localStorage helpers ────────────────────────────────────────────────────

export const loadHistory = (): HistoryEntry[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveHistory = (entries: HistoryEntry[]) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
};

export const addToHistory = (commandId: string, title: string) => {
  const entries = loadHistory();
  const filtered = entries.filter((e) => e.commandId !== commandId);
  filtered.unshift({ commandId, title, timestamp: Date.now() });
  saveHistory(filtered);
};

export const loadFavorites = (): string[] => {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveFavorites = (ids: string[]) => {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
};

export const formatTimestamp = (ts: number): string => {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
};

// ── Fuzzy matching ──────────────────────────────────────────────────────────

export const fuzzyMatch = (query: string, target: string): number[] | null => {
  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();
  const indices: number[] = [];
  let qi = 0;

  for (let ti = 0; ti < lowerTarget.length && qi < lowerQuery.length; ti++) {
    if (lowerTarget[ti] === lowerQuery[qi]) {
      indices.push(ti);
      qi++;
    }
  }

  return qi === lowerQuery.length ? indices : null;
};

export const fuzzyScore = (query: string, target: string, matchIndices: number[]): number => {
  let score = 0;
  const lowerTarget = target.toLowerCase();

  for (let i = 1; i < matchIndices.length; i++) {
    const gap = matchIndices[i] - matchIndices[i - 1] - 1;
    score += gap * 2;
  }

  if (matchIndices.length > 0 && matchIndices[0] === 0) {
    score -= 10;
  }

  for (const idx of matchIndices) {
    if (idx === 0 || lowerTarget[idx - 1] === ' ' || lowerTarget[idx - 1] === ':') {
      score -= 3;
    }
  }

  score += target.length * 0.1;

  return score;
};

// ── Hoisted style objects (created once, never re-allocated) ────────────────

export const highlightStyle: React.CSSProperties = {
  color: 'var(--xp-blue, #7aa2f7)',
  fontWeight: 600,
};

export const sectionHeaderStyle: React.CSSProperties = {
  padding: '10px 16px 4px 16px',
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--xp-text-muted, #565f89)',
};

export const itemBaseStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '8px 16px',
  textAlign: 'left',
  fontSize: '14px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  transition: 'background-color 0.15s, color 0.15s',
  color: 'var(--xp-text-secondary, #a9b1d6)',
};

export const itemSelectedStyle: React.CSSProperties = {
  ...itemBaseStyle,
  backgroundColor: 'rgba(var(--xp-blue-rgb, 122, 162, 247), 0.2)',
  color: 'var(--xp-text, #c0caf5)',
};

export const iconWrapStyle: React.CSSProperties = {
  flexShrink: 0,
  width: '16px',
  height: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0.7,
};

export const shortcutStyle: React.CSSProperties = {
  flexShrink: 0,
  fontSize: '11px',
  color: 'var(--xp-text-muted, #565f89)',
  fontFamily: 'monospace',
  backgroundColor: 'rgba(var(--xp-bg-rgb, 26, 27, 38), 0.5)',
  padding: '2px 6px',
  borderRadius: '4px',
  border: '1px solid rgba(var(--xp-border-rgb, 41, 46, 66), 0.5)',
};

export const timestampStyle: React.CSSProperties = {
  flexShrink: 0,
  fontSize: '10px',
  color: 'var(--xp-text-muted, #565f89)',
};

export const starBtnBaseStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: '2px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'opacity 0.15s',
};

export const kbdStyle: React.CSSProperties = {
  padding: '2px 4px',
  backgroundColor: 'rgba(var(--xp-bg-rgb, 26, 27, 38), 0.5)',
  borderRadius: '3px',
  border: '1px solid rgba(var(--xp-border-rgb, 41, 46, 66), 0.5)',
  fontSize: '10px',
  fontFamily: 'monospace',
};

export const textEllipsisStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const fileNameContainerStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
};

export const fileNameStyle: React.CSSProperties = {
  display: 'block',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const filePathStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  color: 'var(--xp-text-muted, #565f89)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: '15vh',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
};

export const dialogStyle: React.CSSProperties = {
  width: '520px',
  maxHeight: '60vh',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'var(--xp-popover, #1a1b2e)',
  border: '1px solid var(--xp-border, #292e42)',
  borderRadius: '12px',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  overflow: 'hidden',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
};

export const searchBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  borderBottom: '1px solid var(--xp-border, #292e42)',
};

export const searchIconStyle: React.CSSProperties = {
  width: '16px',
  height: '16px',
  flexShrink: 0,
  color: 'var(--xp-text-muted, #565f89)',
};

export const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  color: 'var(--xp-text, #c0caf5)',
  fontSize: '14px',
  outline: 'none',
  border: 'none',
};

export const clearBtnStyle: React.CSSProperties = {
  padding: '2px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--xp-text-muted, #565f89)',
};

export const clearIconStyle: React.CSSProperties = {
  width: '14px',
  height: '14px',
};

export const emptyStateStyle: React.CSSProperties = {
  padding: '32px 16px',
  textAlign: 'center',
  color: 'var(--xp-text-muted, #565f89)',
  fontSize: '14px',
};

export const loadingContainerStyle: React.CSSProperties = {
  padding: '8px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  color: 'var(--xp-text-muted, #565f89)',
  fontSize: '12px',
};

export const loadingSpinnerStyle: React.CSSProperties = {
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  border: '2px solid var(--xp-blue, #7aa2f7)',
  borderTopColor: 'transparent',
  animation: 'spin 1s linear infinite',
};

export const footerStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderTop: '1px solid var(--xp-border, #292e42)',
  fontSize: '11px',
  color: 'var(--xp-text-muted, #565f89)',
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
};

// ── Sub-components ──────────────────────────────────────────────────────────

/** Renders text with matched characters highlighted */
export const HighlightedText = React.memo(
  ({ text, matchIndices }: { text: string; matchIndices: number[] }) => {
    if (matchIndices.length === 0) {
      return <span>{text}</span>;
    }

    const matchSet = new Set(matchIndices);
    const parts: React.ReactNode[] = [];
    let currentRun = '';
    let currentIsMatch = false;

    for (let i = 0; i < text.length; i++) {
      const isMatch = matchSet.has(i);
      if (i === 0) {
        currentIsMatch = isMatch;
        currentRun = text[i];
      } else if (isMatch === currentIsMatch) {
        currentRun += text[i];
      } else {
        parts.push(
          currentIsMatch ? (
            <span key={parts.length} style={highlightStyle}>
              {currentRun}
            </span>
          ) : (
            <span key={parts.length}>{currentRun}</span>
          ),
        );
        currentRun = text[i];
        currentIsMatch = isMatch;
      }
    }

    if (currentRun) {
      parts.push(
        currentIsMatch ? (
          <span key={parts.length} style={highlightStyle}>
            {currentRun}
          </span>
        ) : (
          <span key={parts.length}>{currentRun}</span>
        ),
      );
    }

    return <>{parts}</>;
  },
);
HighlightedText.displayName = 'HighlightedText';

export const StarIcon = React.memo(({ filled, size = 14 }: { filled: boolean; size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'var(--xp-yellow, #e0af68)' : 'none'}
      stroke={filled ? 'var(--xp-yellow, #e0af68)' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
});
StarIcon.displayName = 'StarIcon';

export const ClockIcon = React.memo(({ size = 14 }: { size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
});
ClockIcon.displayName = 'ClockIcon';
