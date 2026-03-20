import React, { useState, useCallback, useMemo } from 'react';
import type { CrossTabSelection } from '@/hooks/use-cross-tab-selection';

// ── Types ────────────────────────────────────────────────────────────────────

interface CrossTabOperationsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selections: Map<string, CrossTabSelection>;
  totalSelectedCount: number;
  selectedTabCount: number;
  onMoveAll: (destination: string) => Promise<void>;
  onCopyAll: (destination: string) => Promise<void>;
  onCompressAll: (destination: string) => Promise<void>;
  onDeleteAll: () => Promise<void>;
  onPickFolder: () => Promise<string | null>;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9998,
  background: 'rgba(0, 0, 0, 0.5)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const dialogStyle: React.CSSProperties = {
  background: 'var(--xp-surface)',
  border: '1px solid var(--xp-border)',
  borderRadius: 12,
  width: 560,
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4)',
  backdropFilter: 'blur(20px)',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid var(--xp-border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--xp-text)',
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--xp-text-muted)',
  marginTop: 2,
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '12px 20px',
};

const tabGroupStyle: React.CSSProperties = {
  marginBottom: 12,
};

const tabGroupHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 0',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--xp-text-secondary)',
};

const fileItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '3px 0 3px 20px',
  fontSize: 12,
  color: 'var(--xp-text)',
};

const destinationSectionStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderTop: '1px solid var(--xp-border)',
};

const destinationRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const destinationInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  fontSize: 12,
  background: 'var(--xp-bg)',
  border: '1px solid var(--xp-border)',
  borderRadius: 6,
  color: 'var(--xp-text)',
  outline: 'none',
};

const browseButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 500,
  background: 'var(--xp-surface-light)',
  border: '1px solid var(--xp-border)',
  borderRadius: 6,
  color: 'var(--xp-text)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const footerStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderTop: '1px solid var(--xp-border)',
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
};

const actionButtonBase: React.CSSProperties = {
  padding: '7px 14px',
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 6,
  border: '1px solid var(--xp-border)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'background 0.15s ease, opacity 0.15s ease',
};

const primaryButtonStyle: React.CSSProperties = {
  ...actionButtonBase,
  background: 'var(--xp-blue)',
  color: '#fff',
  border: '1px solid var(--xp-blue)',
};

const dangerButtonStyle: React.CSSProperties = {
  ...actionButtonBase,
  background: 'rgba(239, 68, 68, 0.15)',
  color: 'var(--xp-red, #ef4444)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
};

const defaultButtonStyle: React.CSSProperties = {
  ...actionButtonBase,
  background: 'var(--xp-surface-light)',
  color: 'var(--xp-text)',
};

const closeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--xp-text-muted)',
  cursor: 'pointer',
  padding: 4,
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const progressBarContainerStyle: React.CSSProperties = {
  width: '100%',
  height: 4,
  borderRadius: 2,
  background: 'var(--xp-border)',
  overflow: 'hidden',
  marginTop: 8,
};

const progressBarFillStyle = (pct: number): React.CSSProperties => ({
  height: '100%',
  width: `${pct}%`,
  background: 'var(--xp-blue)',
  borderRadius: 2,
  transition: 'width 0.3s ease',
});

const statusTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--xp-text-muted)',
  marginTop: 6,
};

// ── SVG icons (inline) ──────────────────────────────────────────────────────

const FolderIcon = () => {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, color: 'var(--xp-yellow, #eab308)' }}
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

const FileIcon = () => {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, color: 'var(--xp-text-muted)' }}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

const CloseIcon = () => {
  return (
    <svg
      width="16"
      height="16"
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
  );
}

// ── Component ────────────────────────────────────────────────────────────────

const CrossTabOperationsDialog = ({
  isOpen,
  onClose,
  selections,
  totalSelectedCount,
  selectedTabCount,
  onMoveAll,
  onCopyAll,
  onCompressAll,
  onDeleteAll,
  onPickFolder,
}: CrossTabOperationsDialogProps) => {
  const [destination, setDestination] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const selectionEntries = useMemo(() => Array.from(selections.values()), [selections]);

  const handleBrowse = useCallback(async () => {
    const folder = await onPickFolder();
    if (folder) {
      setDestination(folder);
    }
  }, [onPickFolder]);

  const runOperation = useCallback(
    async (op: (dest: string) => Promise<void>, requiresDest: boolean) => {
      if (requiresDest && !destination.trim()) return;
      setIsProcessing(true);
      setProgress(0);
      setStatusMessage('Starting operation...');
      try {
        // Simulate progress updates (actual progress comes from operation)
        const progressInterval = setInterval(() => {
          setProgress((p) => Math.min(p + 5, 90));
        }, 200);

        await op(destination.trim());

        clearInterval(progressInterval);
        setProgress(100);
        setStatusMessage('Operation completed successfully.');
        setTimeout(() => {
          setIsProcessing(false);
          setProgress(0);
          setStatusMessage('');
          onClose();
        }, 800);
      } catch (err) {
        setIsProcessing(false);
        setProgress(0);
        setStatusMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [destination, onClose],
  );

  const handleMoveAll = useCallback(() => runOperation(onMoveAll, true), [runOperation, onMoveAll]);
  const handleCopyAll = useCallback(() => runOperation(onCopyAll, true), [runOperation, onCopyAll]);
  const handleCompressAll = useCallback(
    () => runOperation(onCompressAll, true),
    [runOperation, onCompressAll],
  );
  const handleDeleteAll = useCallback(async () => {
    setIsProcessing(true);
    setProgress(0);
    setStatusMessage('Deleting files...');
    try {
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 5, 90));
      }, 200);
      await onDeleteAll();
      clearInterval(progressInterval);
      setProgress(100);
      setStatusMessage('All files deleted.');
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
        setStatusMessage('');
        onClose();
      }, 800);
    } catch (err) {
      setIsProcessing(false);
      setProgress(0);
      setStatusMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [onDeleteAll, onClose]);

  if (!isOpen) return null;

  const hasDestination = destination.trim().length > 0;

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div style={dialogStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <h2 style={titleStyle}>Batch Operations</h2>
            <div style={subtitleStyle}>
              {totalSelectedCount} file{totalSelectedCount !== 1 ? 's' : ''} from {selectedTabCount}{' '}
              tab{selectedTabCount !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            style={closeButtonStyle}
            onClick={onClose}
            disabled={isProcessing}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--xp-surface-light)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body: file list grouped by tab */}
        <div style={bodyStyle}>
          {selectionEntries.map((sel) => (
            <div key={sel.tabId} style={tabGroupStyle}>
              <div style={tabGroupHeaderStyle}>
                <FolderIcon />
                <span>{sel.tabPath}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--xp-text-muted)',
                    fontWeight: 400,
                  }}
                >
                  ({sel.files.length} file{sel.files.length !== 1 ? 's' : ''})
                </span>
              </div>
              {sel.files.map((file) => (
                <div key={file.path} style={fileItemStyle}>
                  {file.is_dir ? <FolderIcon /> : <FileIcon />}
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {file.name}
                  </span>
                  {!file.is_dir && file.size > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--xp-text-muted)',
                        marginLeft: 'auto',
                        flexShrink: 0,
                      }}
                    >
                      {formatSize(file.size)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Destination input */}
        <div style={destinationSectionStyle}>
          <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', marginBottom: 6 }}>
            Destination folder (for Move, Copy, Compress):
          </div>
          <div style={destinationRowStyle}>
            <input
              style={destinationInputStyle}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Select a destination folder..."
              disabled={isProcessing}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-blue)';
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-border)';
              }}
            />
            <button
              style={browseButtonStyle}
              onClick={handleBrowse}
              disabled={isProcessing}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--xp-surface)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--xp-surface-light)';
              }}
            >
              Browse...
            </button>
          </div>

          {/* Progress indicator */}
          {isProcessing && (
            <>
              <div style={progressBarContainerStyle}>
                <div style={progressBarFillStyle(progress)} />
              </div>
              {statusMessage && <div style={statusTextStyle}>{statusMessage}</div>}
            </>
          )}
        </div>

        {/* Footer with operation buttons */}
        <div style={footerStyle}>
          <button
            style={{
              ...primaryButtonStyle,
              opacity: hasDestination && !isProcessing ? 1 : 0.5,
              cursor: hasDestination && !isProcessing ? 'pointer' : 'not-allowed',
            }}
            onClick={handleMoveAll}
            disabled={!hasDestination || isProcessing}
            onMouseEnter={(e) => {
              if (hasDestination && !isProcessing) {
                (e.currentTarget as HTMLElement).style.opacity = '0.85';
              }
            }}
            onMouseLeave={(e) => {
              if (hasDestination && !isProcessing) {
                (e.currentTarget as HTMLElement).style.opacity = '1';
              }
            }}
          >
            <MoveIcon />
            Move All to...
          </button>
          <button
            style={{
              ...defaultButtonStyle,
              opacity: hasDestination && !isProcessing ? 1 : 0.5,
              cursor: hasDestination && !isProcessing ? 'pointer' : 'not-allowed',
            }}
            onClick={handleCopyAll}
            disabled={!hasDestination || isProcessing}
            onMouseEnter={(e) => {
              if (hasDestination && !isProcessing) {
                (e.currentTarget as HTMLElement).style.background = 'var(--xp-surface)';
              }
            }}
            onMouseLeave={(e) => {
              if (hasDestination && !isProcessing) {
                (e.currentTarget as HTMLElement).style.background = 'var(--xp-surface-light)';
              }
            }}
          >
            <CopyIcon />
            Copy All to...
          </button>
          <button
            style={{
              ...defaultButtonStyle,
              opacity: hasDestination && !isProcessing ? 1 : 0.5,
              cursor: hasDestination && !isProcessing ? 'pointer' : 'not-allowed',
            }}
            onClick={handleCompressAll}
            disabled={!hasDestination || isProcessing}
            onMouseEnter={(e) => {
              if (hasDestination && !isProcessing) {
                (e.currentTarget as HTMLElement).style.background = 'var(--xp-surface)';
              }
            }}
            onMouseLeave={(e) => {
              if (hasDestination && !isProcessing) {
                (e.currentTarget as HTMLElement).style.background = 'var(--xp-surface-light)';
              }
            }}
          >
            <CompressIcon />
            Compress All
          </button>
          <button
            style={{
              ...dangerButtonStyle,
              opacity: !isProcessing ? 1 : 0.5,
              cursor: !isProcessing ? 'pointer' : 'not-allowed',
            }}
            onClick={handleDeleteAll}
            disabled={isProcessing}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(239, 68, 68, 0.25)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isProcessing) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(239, 68, 68, 0.15)';
              }
            }}
          >
            <TrashIcon />
            Delete All
          </button>

          {/* Spacer + close */}
          <div style={{ flex: 1 }} />
          <button
            style={{
              ...actionButtonBase,
              background: 'transparent',
              color: 'var(--xp-text-muted)',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
            }}
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(CrossTabOperationsDialog);

// ── Tiny inline icons ────────────────────────────────────────────────────────

const MoveIcon = () => {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="5 9 2 12 5 15" />
      <polyline points="9 5 12 2 15 5" />
      <polyline points="15 19 12 22 9 19" />
      <polyline points="19 9 22 12 19 15" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="12" y1="2" x2="12" y2="22" />
    </svg>
  );
}

const CopyIcon = () => {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

const CompressIcon = () => {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" />
      <path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <polyline points="8 8 12 4 16 8" />
      <polyline points="16 16 12 20 8 16" />
    </svg>
  );
}

const TrashIcon = () => {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatSize = (bytes: number) : string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
