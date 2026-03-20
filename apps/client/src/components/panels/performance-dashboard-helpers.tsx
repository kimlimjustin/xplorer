import React from 'react';
import {
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  Laptop,
  ArchiveX,
  BarChart3,
  FolderClosed,
  FolderOpen,
  CalendarDays,
  Tag,
} from 'lucide-react';
import type { FileEntry, FolderSuggestion } from '@/lib/tauri-api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PerformanceDashboardProps {
  currentPath: string;
  allFiles: FileEntry[];
  navigateToPath?: (path: string) => void;
}

// ── Inline style helpers ────────────────────────────────────────────────────

export const cardStyle: React.CSSProperties = {
  background: 'var(--xp-surface-light)',
  borderRadius: 8,
  padding: '12px 14px',
  marginBottom: 10,
  border: '1px solid var(--xp-border)',
};

export const cardTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  color: 'var(--xp-text-secondary)',
  marginBottom: 10,
};

export const statRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '3px 0',
  fontSize: 13,
};

export const statLabelStyle: React.CSSProperties = {
  color: 'var(--xp-text-secondary)',
};

export const statValueStyle: React.CSSProperties = {
  color: 'var(--xp-text)',
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
};

export const progressBarContainer: React.CSSProperties = {
  width: '100%',
  height: 4,
  borderRadius: 2,
  background: 'var(--xp-border)',
  marginTop: 6,
  overflow: 'hidden',
};

export const smallBtnStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '3px 8px',
  borderRadius: 4,
  border: '1px solid var(--xp-border)',
  background: 'var(--xp-surface)',
  color: 'var(--xp-text)',
  cursor: 'pointer',
  transition: 'background 0.15s',
  whiteSpace: 'nowrap' as const,
};

export const suggestionRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  padding: '6px 0',
  borderBottom: '1px solid var(--xp-border)',
};

export const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  width: '100%',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: 'var(--xp-text-secondary)',
  transition: 'background 0.15s',
};

// ── Sub-components ──────────────────────────────────────────────────────────

export const StatRow = React.memo(function StatRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div style={statRowStyle}>
      <span style={statLabelStyle}>{label}</span>
      <span style={statValueStyle}>{value}</span>
    </div>
  );
});

export const ProgressBar = React.memo(function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={progressBarContainer}>
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 2,
          background: color,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
});

// ── Operation color mapping ─────────────────────────────────────────────────

export const opColor = (op: string, success: boolean): string => {
  if (!success) return '#ef4444';
  const lower = op.toLowerCase();
  if (lower.includes('copy')) return '#3b82f6';
  if (lower.includes('move')) return '#8b5cf6';
  if (lower.includes('delete') || lower.includes('trash')) return '#ef4444';
  if (lower.includes('rename')) return '#f59e0b';
  if (lower.includes('create') || lower.includes('mkdir')) return '#22c55e';
  if (lower.includes('compress') || lower.includes('extract')) return '#06b6d4';
  return '#94a3b8';
};

export const formatRelativeTime = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - date.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  } catch {
    return timestamp;
  }
};

// ── Category constants for Organizer tab ────────────────────────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  Images: '#a855f7',
  Videos: '#3b82f6',
  Audio: '#eab308',
  Documents: '#22c55e',
  Code: '#06b6d4',
  Archives: '#ef4444',
  Data: '#f97316',
  Other: '#94a3b8',
};

export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Images: <ImageIcon size={14} className="inline-block" />,
  Videos: <Film size={14} className="inline-block" />,
  Audio: <Music size={14} className="inline-block" />,
  Documents: <FileText size={14} className="inline-block" />,
  Code: <Laptop size={14} className="inline-block" />,
  Archives: <ArchiveX size={14} className="inline-block" />,
  Data: <BarChart3 size={14} className="inline-block" />,
  Other: <FolderClosed size={14} className="inline-block" />,
};

// ── Organizer sub-components ────────────────────────────────────────────────

export const OrganizerSectionHeader = ({
  title,
  collapsed,
  onToggle,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
}) => {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        width: '100%',
        padding: '4px 0',
        marginBottom: 4,
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--xp-text-secondary)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        transition: 'color 0.15s',
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 20 20"
        fill="currentColor"
        style={{
          transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
          transition: 'transform 0.15s',
        }}
      >
        <path
          fillRule="evenodd"
          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      </svg>
      {title}
    </button>
  );
};

export const OrganizerSuggestionItem = ({
  suggestion,
  selected,
  onToggle,
}: {
  suggestion: FolderSuggestion;
  selected: boolean;
  onToggle: () => void;
}) => {
  const categoryTag =
    suggestion.category === 'type'
      ? <FolderOpen size={12} className="inline-block" />
      : suggestion.category === 'date'
        ? <CalendarDays size={12} className="inline-block" />
        : <Tag size={12} className="inline-block" />;
  return (
    <div
      onClick={onToggle}
      style={{
        ...cardStyle,
        marginBottom: 4,
        padding: '8px 10px',
        cursor: 'pointer',
        borderColor: selected ? 'var(--xp-blue, #3b82f6)' : 'var(--xp-border)',
        background: selected ? 'rgba(59, 130, 246, 0.08)' : 'var(--xp-surface-light)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          style={{ flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12 }}>{categoryTag}</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--xp-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {suggestion.suggested_name}/
            </span>
            <span
              style={{ fontSize: 11, color: 'var(--xp-text-secondary)', flexShrink: 0 }}
            >
              ({suggestion.files_to_move.length} files)
            </span>
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--xp-text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 2,
            }}
          >
            {suggestion.reason}
          </div>
        </div>
      </div>
    </div>
  );
};
