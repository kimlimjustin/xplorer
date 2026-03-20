import React, { useState, useRef, useCallback } from 'react';
import { FileEntry, TauriAPI } from '@/lib/tauri-api';
import { showConfirmationToast, showInputToast } from '@/components/ui/Toast';

interface PreviewActionBarProps {
  file: FileEntry;
}

/** Tiny feedback label that fades out after a short delay. */
const useFeedback = () : [string | null, (msg: string) => void] => {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg(text);
    timer.current = setTimeout(() => {
      setMsg(null);
      timer.current = null;
    }, 1500);
  }, []);
  return [msg, show];
}

// Inline SVG icons -- kept tiny & self-contained to avoid extra deps.
const icons = {
  open: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
    </svg>
  ),
  copyPath: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
      <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
      <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
    </svg>
  ),
  copyName: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
        clipRule="evenodd"
      />
    </svg>
  ),
  duplicate: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
      <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
    </svg>
  ),
  rename: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
    </svg>
  ),
  delete: (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

const PATH_SEP_RE = /[/\\]/;

/**
 * Quick-actions bar for the file preview panel.
 * Renders a compact horizontal row of icon buttons for common file operations.
 */
const PreviewActionBar = ({ file }: PreviewActionBarProps) => {
  const [feedback, showFeedback] = useFeedback();

  // ── Actions ────────────────────────────────────────────────────────────

  const handleOpen = useCallback(async () => {
    try {
      await TauriAPI.openFile(file.path);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }, [file.path]);

  const handleCopyPath = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(file.path);
      showFeedback('Path copied');
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  }, [file.path, showFeedback]);

  const handleCopyName = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(file.name);
      showFeedback('Name copied');
    } catch (err) {
      console.error('Failed to copy name:', err);
    }
  }, [file.name, showFeedback]);

  const handleDuplicate = useCallback(async () => {
    try {
      const parts = file.path.split(PATH_SEP_RE);
      const sep = file.path.includes('\\') ? '\\' : '/';
      const parentDir = parts.slice(0, -1).join(sep);
      const dotIdx = file.name.lastIndexOf('.');
      let destName: string;
      if (file.is_dir) {
        destName = `${file.name} - Copy`;
      } else if (dotIdx > 0) {
        destName = `${file.name.slice(0, dotIdx)} - Copy${file.name.slice(dotIdx)}`;
      } else {
        destName = `${file.name} - Copy`;
      }
      const destPath = `${parentDir}${sep}${destName}`;
      await TauriAPI.copy(file.path, destPath);
      window.dispatchEvent(new CustomEvent('files-changed'));
      showFeedback('Duplicated');
    } catch (err) {
      console.error('Failed to duplicate file:', err);
    }
  }, [file.path, file.name, file.is_dir, showFeedback]);

  const handleRename = useCallback(async () => {
    const newName = await showInputToast({
      title: 'Rename',
      description: 'Enter new name:',
      placeholder: file.name,
      submitText: 'Rename',
      cancelText: 'Cancel',
    });
    if (newName && newName !== file.name) {
      try {
        const parts = file.path.split(PATH_SEP_RE);
        parts[parts.length - 1] = newName;
        const sep = file.path.includes('\\') ? '\\' : '/';
        const newPath = parts.join(sep);
        await TauriAPI.rename(file.path, newPath);
        window.dispatchEvent(new CustomEvent('files-changed'));
        showFeedback('Renamed');
      } catch (err) {
        console.error('Failed to rename file:', err);
      }
    }
  }, [file.path, file.name, showFeedback]);

  const handleDelete = useCallback(async () => {
    const confirmed = await showConfirmationToast({
      title: 'Delete File',
      description: `Are you sure you want to delete "${file.name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });
    if (confirmed) {
      try {
        await TauriAPI.moveToTrash(file.path);
        window.dispatchEvent(new CustomEvent('files-changed'));
        showFeedback('Deleted');
      } catch (err) {
        console.error('Failed to delete file:', err);
      }
    }
  }, [file.path, file.name, showFeedback]);

  // ── Button definitions ─────────────────────────────────────────────────

  const actions: {
    key: string;
    icon: React.ReactElement;
    label: string;
    tooltip: string;
    onClick: () => void;
    danger?: boolean;
  }[] = [
    {
      key: 'open',
      icon: icons.open,
      label: 'Open',
      tooltip: 'Open with default app (Enter / Ctrl+O)',
      onClick: handleOpen,
    },
    {
      key: 'copy-path',
      icon: icons.copyPath,
      label: 'Copy Path',
      tooltip: 'Copy full path (Ctrl+Shift+C)',
      onClick: handleCopyPath,
    },
    {
      key: 'copy-name',
      icon: icons.copyName,
      label: 'Copy Name',
      tooltip: 'Copy filename',
      onClick: handleCopyName,
    },
    {
      key: 'duplicate',
      icon: icons.duplicate,
      label: 'Duplicate',
      tooltip: 'Duplicate file',
      onClick: handleDuplicate,
    },
    {
      key: 'rename',
      icon: icons.rename,
      label: 'Rename',
      tooltip: 'Rename file',
      onClick: handleRename,
    },
    {
      key: 'delete',
      icon: icons.delete,
      label: 'Delete',
      tooltip: 'Move to trash (Delete)',
      onClick: handleDelete,
      danger: true,
    },
  ];

  // ── Styles ──────────────────────────────────────────────────────────────

  const barStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '2px',
    padding: '6px 8px',
    borderBottom: '1px solid var(--xp-border)',
    background: 'var(--xp-surface)',
    alignItems: 'center',
    position: 'relative',
  };

  const btnBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid transparent',
    background: 'transparent',
    color: 'var(--xp-text-secondary)',
    fontSize: '11px',
    lineHeight: 1,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };

  const feedbackStyle: React.CSSProperties = {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '10px',
    color: 'var(--xp-green, #9ece6a)',
    pointerEvents: 'none',
    animation: 'fadeIn 0.15s ease-out',
  };

  return (
    <div style={barStyle} role="toolbar" aria-label="Quick actions">
      {actions.map(({ key, icon, label, tooltip, onClick, danger }) => (
        <button
          key={key}
          onClick={onClick}
          title={tooltip}
          aria-label={tooltip}
          style={btnBase}
          onMouseEnter={(e) => {
            const target = e.currentTarget;
            target.style.background = danger
              ? 'rgba(247, 118, 142, 0.15)'
              : 'var(--xp-surface-light, rgba(255,255,255,0.06))';
            target.style.color = danger ? 'var(--xp-red, #f7768e)' : 'var(--xp-text)';
            target.style.borderColor = danger ? 'rgba(247, 118, 142, 0.3)' : 'var(--xp-border)';
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget;
            target.style.background = 'transparent';
            target.style.color = 'var(--xp-text-secondary)';
            target.style.borderColor = 'transparent';
          }}
        >
          {icon}
          <span>{label}</span>
        </button>
      ))}
      {feedback && <span style={feedbackStyle}>{feedback}</span>}
    </div>
  );
}

export default PreviewActionBar;
