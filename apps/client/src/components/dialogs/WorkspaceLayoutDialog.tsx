/**
 * WorkspaceLayoutDialog -- save / load / manage workspace layouts.
 *
 * Uses inline styles with CSS variables (--xp-*) to match the rest of the app.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getLayouts,
  saveLayout,
  deleteLayout,
  renameLayout,
  countTabs,
  getDefaultLayout,
  type WorkspaceLayout,
  type WorkspaceLayoutUiState,
} from '@/lib/workspace-layouts';
import type { SplitLayoutState } from '@/types/split-view';

// ── Props ────────────────────────────────────────────────────────────────────

interface WorkspaceLayoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Current split layout state to save */
  currentLayout: SplitLayoutState;
  /** Current UI state to save alongside the layout */
  currentUiState: WorkspaceLayoutUiState;
  /** Called when the user wants to apply a layout */
  onApplyLayout: (layout: SplitLayoutState, uiState: WorkspaceLayoutUiState) => void;
}

// ── Inline styles ────────────────────────────────────────────────────────────

const s = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 9998,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    animation: 'fadeIn 150ms ease-out',
  },
  dialog: {
    position: 'relative' as const,
    width: '100%',
    maxWidth: '560px',
    maxHeight: '75vh',
    margin: '0 16px',
    borderRadius: '12px',
    backgroundColor: 'var(--xp-popover)',
    border: '1px solid var(--xp-border)',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    animation: 'slideUp 200ms ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px 12px',
    borderBottom: '1px solid var(--xp-border)',
    flexShrink: 0,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--xp-text)',
    margin: 0,
  },
  badge: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--xp-text-secondary)',
    backgroundColor: 'var(--xp-surface-light)',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  closeBtn: {
    padding: '4px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--xp-text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 150ms, color 150ms',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    borderBottom: '1px solid var(--xp-border)',
    flexShrink: 0,
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 500,
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'var(--xp-blue)',
    color: '#fff',
    cursor: 'pointer',
    transition: 'opacity 150ms',
    whiteSpace: 'nowrap' as const,
  },
  ghostBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 500,
    borderRadius: '6px',
    border: '1px solid var(--xp-border)',
    backgroundColor: 'transparent',
    color: 'var(--xp-text-secondary)',
    cursor: 'pointer',
    transition: 'background-color 150ms, color 150ms',
    whiteSpace: 'nowrap' as const,
  },
  body: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '8px 20px 20px',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '40px 0',
    color: 'var(--xp-text-secondary)',
    fontSize: '13px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '8px',
    transition: 'background-color 150ms',
    gap: '12px',
    marginBottom: '4px',
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden' as const,
  },
  rowName: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--xp-text)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
  },
  rowMeta: {
    fontSize: '11px',
    color: 'var(--xp-text-secondary)',
    marginTop: '2px',
  },
  rowActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  iconBtn: {
    padding: '4px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--xp-text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 150ms, color 150ms',
  },
  nameInput: {
    width: '100%',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid var(--xp-blue)',
    backgroundColor: 'var(--xp-surface)',
    color: 'var(--xp-text)',
    fontSize: '13px',
    padding: '0 10px',
    outline: 'none',
  },
  footer: {
    padding: '10px 20px',
    borderTop: '1px solid var(--xp-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    fontSize: '11px',
    color: 'var(--xp-text-secondary)',
  },
} as const;

// ── Inline SVG icons ─────────────────────────────────────────────────────────

const IconX = ({ size = 16 }: { size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
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

const IconSave = ({ size = 14 }: { size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

const IconReset = ({ size = 14 }: { size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  );
}

const IconPlay = ({ size = 14 }: { size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

const IconEdit = ({ size = 14 }: { size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

const IconTrash = ({ size = 14 }: { size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

const IconLayout = ({ size = 18 }: { size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (ts: number) : string => {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

const countPanes = (layout: SplitLayoutState) : number => {
  return Object.keys(layout.groups).length;
}

// ── Component ────────────────────────────────────────────────────────────────

const WorkspaceLayoutDialog = ({
  isOpen,
  onClose,
  currentLayout,
  currentUiState,
  onApplyLayout,
}: WorkspaceLayoutDialogProps) => {
  const [layouts, setLayouts] = useState<WorkspaceLayout[]>([]);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [saveInput, setSaveInput] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Refresh list when dialog opens
  useEffect(() => {
    if (isOpen) {
      setLayouts(getLayouts());
      setRenamingId(null);
      setSavingName(false);
      setSaveInput('');
    }
  }, [isOpen]);

  // Focus save input when entering save mode
  useEffect(() => {
    if (savingName) {
      const t = setTimeout(() => saveInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [savingName]);

  // Focus rename input
  useEffect(() => {
    if (renamingId) {
      const t = setTimeout(() => renameInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [renamingId]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (renamingId) {
          setRenamingId(null);
          return;
        }
        if (savingName) {
          setSavingName(false);
          return;
        }
        onClose();
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [isOpen, onClose, renamingId, savingName]);

  // Click outside
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const name = saveInput.trim();
    if (!name) return;
    saveLayout(name, currentLayout, currentUiState);
    setLayouts(getLayouts());
    setSavingName(false);
    setSaveInput('');
  };

  const handleDelete = (id: string) => {
    deleteLayout(id);
    setLayouts(getLayouts());
  };

  const handleRenameSubmit = () => {
    if (renamingId && renameValue.trim()) {
      renameLayout(renamingId, renameValue.trim());
      setLayouts(getLayouts());
    }
    setRenamingId(null);
  };

  const handleLoad = (wl: WorkspaceLayout) => {
    onApplyLayout(wl.layout, wl.uiState);
    onClose();
  };

  const handleResetDefault = () => {
    const defaultLayout = getDefaultLayout();
    const defaultUi: WorkspaceLayoutUiState = {
      viewMode: 'medium',
      theme: currentUiState.theme,
      leftSidebarCollapsed: false,
      rightSidebarCollapsed: false,
      bottomPanelCollapsed: true,
    };
    onApplyLayout(defaultLayout, defaultUi);
    onClose();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      style={s.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Workspace Layouts"
    >
      <div style={s.dialog}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.titleRow}>
            <IconLayout />
            <h2 style={s.title}>Workspace Layouts</h2>
            <span style={s.badge}>{layouts.length} / 10</span>
          </div>
          <button
            onClick={onClose}
            style={s.closeBtn}
            aria-label="Close"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--xp-surface-light)';
              e.currentTarget.style.color = 'var(--xp-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--xp-text-secondary)';
            }}
          >
            <IconX />
          </button>
        </div>

        {/* Toolbar */}
        <div style={s.toolbar}>
          {savingName ? (
            <form
              style={{ display: 'flex', gap: '8px', flex: 1 }}
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <input
                ref={saveInputRef}
                type="text"
                value={saveInput}
                onChange={(e) => setSaveInput(e.target.value)}
                placeholder="Layout name..."
                style={{ ...s.nameInput, flex: 1 }}
                maxLength={50}
              />
              <button
                type="submit"
                style={{ ...s.primaryBtn, opacity: saveInput.trim() ? 1 : 0.5 }}
                disabled={!saveInput.trim()}
              >
                Save
              </button>
              <button type="button" style={s.ghostBtn} onClick={() => setSavingName(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <>
              <button
                style={s.primaryBtn}
                onClick={() => {
                  setSavingName(true);
                  setSaveInput('');
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.85';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                disabled={layouts.length >= 10}
                title={layouts.length >= 10 ? 'Maximum 10 layouts reached' : undefined}
              >
                <IconSave /> Save Current
              </button>
              <button
                style={s.ghostBtn}
                onClick={handleResetDefault}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--xp-surface-light)';
                  e.currentTarget.style.color = 'var(--xp-text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--xp-text-secondary)';
                }}
              >
                <IconReset /> Default Layout
              </button>
            </>
          )}
        </div>

        {/* Body */}
        <div style={s.body}>
          {layouts.length === 0 ? (
            <div style={s.emptyState}>
              No saved layouts yet.
              <br />
              Click "Save Current" to save your current workspace arrangement.
            </div>
          ) : (
            layouts.map((wl) => {
              const isHovered = hoveredRow === wl.id;
              const isRenaming = renamingId === wl.id;
              const tabCount = countTabs(wl.layout);
              const paneCount = countPanes(wl.layout);

              return (
                <div
                  key={wl.id}
                  style={{
                    ...s.row,
                    backgroundColor: isHovered ? 'var(--xp-surface-light)' : 'transparent',
                  }}
                  onMouseEnter={() => setHoveredRow(wl.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  {/* Info */}
                  <div style={s.rowInfo}>
                    {isRenaming ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleRenameSubmit();
                        }}
                      >
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={handleRenameSubmit}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          style={s.nameInput}
                          maxLength={50}
                        />
                      </form>
                    ) : (
                      <>
                        <div style={s.rowName}>{wl.name}</div>
                        <div style={s.rowMeta}>
                          {paneCount} pane{paneCount !== 1 ? 's' : ''} &middot; {tabCount} tab
                          {tabCount !== 1 ? 's' : ''} &middot; {formatDate(wl.created)}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Action buttons (visible on hover) */}
                  {!isRenaming && (
                    <div style={{ ...s.rowActions, opacity: isHovered ? 1 : 0 }}>
                      {/* Load */}
                      <button
                        style={s.iconBtn}
                        title="Load layout"
                        aria-label={`Load ${wl.name}`}
                        onClick={() => handleLoad(wl)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--xp-surface-light)';
                          e.currentTarget.style.color = 'var(--xp-blue)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--xp-text-secondary)';
                        }}
                      >
                        <IconPlay />
                      </button>
                      {/* Rename */}
                      <button
                        style={s.iconBtn}
                        title="Rename"
                        aria-label={`Rename ${wl.name}`}
                        onClick={() => {
                          setRenamingId(wl.id);
                          setRenameValue(wl.name);
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--xp-surface-light)';
                          e.currentTarget.style.color = 'var(--xp-text)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--xp-text-secondary)';
                        }}
                      >
                        <IconEdit />
                      </button>
                      {/* Delete */}
                      <button
                        style={s.iconBtn}
                        title="Delete"
                        aria-label={`Delete ${wl.name}`}
                        onClick={() => handleDelete(wl.id)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--xp-surface-light)';
                          e.currentTarget.style.color = '#ef4444';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--xp-text-secondary)';
                        }}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <span>
            Press{' '}
            <span
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '10px',
                padding: '1px 5px',
                backgroundColor: 'var(--xp-surface-light)',
                border: '1px solid var(--xp-border)',
                borderRadius: '4px',
                boxShadow: '0 1px 0 var(--xp-border)',
              }}
            >
              Esc
            </span>{' '}
            to close
          </span>
          <span>Ctrl+Shift+L to toggle</span>
        </div>
      </div>
    </div>
  );
}

export default WorkspaceLayoutDialog;
