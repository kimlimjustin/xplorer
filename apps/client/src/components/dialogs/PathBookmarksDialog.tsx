import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getPathBookmarks,
  setPathBookmark,
  removePathBookmark,
  getFolderName,
  type PathBookmark,
} from '@/lib/path-bookmarks';

// ── Styles (inline, using CSS variables) ──────────────────────────────────────

const styles = {
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
    maxHeight: '80vh',
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
  closeButton: {
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
  body: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 20px 20px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  slot: {
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '14px 10px',
    borderRadius: '10px',
    border: '1px solid var(--xp-border)',
    backgroundColor: 'var(--xp-surface)',
    cursor: 'pointer',
    transition: 'background-color 150ms, border-color 150ms, box-shadow 150ms',
    minHeight: '90px',
    textAlign: 'center' as const,
  },
  slotHover: {
    backgroundColor: 'var(--xp-surface-light)',
    borderColor: 'var(--xp-blue)',
  },
  slotActive: {
    borderColor: 'var(--xp-blue)',
    boxShadow: '0 0 0 1px var(--xp-blue)',
  },
  numberBadge: {
    position: 'absolute' as const,
    top: '6px',
    left: '8px',
    width: '20px',
    height: '20px',
    borderRadius: '5px',
    backgroundColor: 'var(--xp-surface-light)',
    border: '1px solid var(--xp-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 600,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    color: 'var(--xp-text-secondary)',
  },
  numberBadgeActive: {
    backgroundColor: 'var(--xp-blue)',
    borderColor: 'var(--xp-blue)',
    color: '#fff',
  },
  slotIcon: {
    fontSize: '20px',
    lineHeight: 1,
  },
  slotLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--xp-text)',
    maxWidth: '100%',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },
  slotPath: {
    fontSize: '10px',
    color: 'var(--xp-text-secondary)',
    maxWidth: '100%',
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
    opacity: 0.7,
  },
  slotEmpty: {
    fontSize: '12px',
    color: 'var(--xp-text-secondary)',
    opacity: 0.5,
  },
  currentIndicator: {
    position: 'absolute' as const,
    top: '6px',
    right: '8px',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--xp-green, #4ade80)',
  },
  contextMenu: {
    position: 'fixed' as const,
    zIndex: 9999,
    minWidth: '160px',
    borderRadius: '8px',
    backgroundColor: 'var(--xp-surface)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid var(--xp-border)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    padding: '4px',
    animation: 'fadeIn 100ms ease-out',
  },
  contextMenuItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '6px 12px',
    fontSize: '12px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--xp-text)',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background-color 150ms',
    textAlign: 'left' as const,
    gap: '8px',
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
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px 6px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '10px',
    fontWeight: 500,
    color: 'var(--xp-text-secondary)',
    backgroundColor: 'var(--xp-surface-light)',
    border: '1px solid var(--xp-border)',
    borderRadius: '3px',
    lineHeight: '16px',
    boxShadow: '0 1px 0 var(--xp-border)',
  },
  editInput: {
    width: '100%',
    padding: '4px 8px',
    fontSize: '12px',
    borderRadius: '6px',
    border: '1px solid var(--xp-border)',
    backgroundColor: 'var(--xp-surface)',
    color: 'var(--xp-text)',
    outline: 'none',
    transition: 'border-color 150ms',
  },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

interface PathBookmarksDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}

const PathBookmarksDialog = React.memo(
  ({ isOpen, onClose, currentPath, onNavigate }: PathBookmarksDialogProps) => {
    const [bookmarks, setBookmarks] = useState<PathBookmark[]>([]);
    const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slot: number } | null>(
      null,
    );
    const [editingSlot, setEditingSlot] = useState<number | null>(null);
    const [editLabel, setEditLabel] = useState('');
    const overlayRef = useRef<HTMLDivElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    // Load bookmarks when dialog opens and listen for changes
    useEffect(() => {
      if (!isOpen) return;
      setBookmarks(getPathBookmarks());
      setContextMenu(null);
      setEditingSlot(null);

      const handler = () => setBookmarks(getPathBookmarks());
      window.addEventListener('path-bookmarks-changed', handler);
      return () => window.removeEventListener('path-bookmarks-changed', handler);
    }, [isOpen]);

    // Focus edit input when editing
    useEffect(() => {
      if (editingSlot !== null) {
        const timer = setTimeout(() => editInputRef.current?.focus(), 50);
        return () => clearTimeout(timer);
      }
    }, [editingSlot]);

    // Close on Escape
    useEffect(() => {
      if (!isOpen) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          if (editingSlot !== null) {
            setEditingSlot(null);
          } else if (contextMenu) {
            setContextMenu(null);
          } else {
            onClose();
          }
        }
      };
      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, onClose, editingSlot, contextMenu]);

    // Close context menu on click elsewhere
    useEffect(() => {
      if (!contextMenu) return;
      const close = () => setContextMenu(null);
      document.addEventListener('click', close, { once: true });
      return () => document.removeEventListener('click', close);
    }, [contextMenu]);

    const handleOverlayClick = useCallback(
      (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) onClose();
      },
      [onClose],
    );

    const handleSlotClick = useCallback(
      (slot: number) => {
        const bm = bookmarks.find((b) => b.slot === slot);
        if (bm) {
          onNavigate(bm.path);
          onClose();
        } else {
          // Assign current path to this slot
          if (currentPath && !currentPath.startsWith('xplorer://')) {
            setPathBookmark(slot, currentPath);
          }
        }
      },
      [bookmarks, currentPath, onNavigate, onClose],
    );

    const handleSlotRightClick = useCallback((e: React.MouseEvent, slot: number) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, slot });
    }, []);

    const handleAssignCurrent = useCallback(
      (slot: number) => {
        if (currentPath && !currentPath.startsWith('xplorer://')) {
          setPathBookmark(slot, currentPath);
        }
        setContextMenu(null);
      },
      [currentPath],
    );

    const handleEditLabel = useCallback(
      (slot: number) => {
        const bm = bookmarks.find((b) => b.slot === slot);
        setEditLabel(bm?.label || getFolderName(bm?.path || ''));
        setEditingSlot(slot);
        setContextMenu(null);
      },
      [bookmarks],
    );

    const handleSaveLabel = useCallback(() => {
      if (editingSlot === null) return;
      const bm = bookmarks.find((b) => b.slot === editingSlot);
      if (bm) {
        setPathBookmark(editingSlot, bm.path, editLabel.trim() || undefined, bm.icon);
      }
      setEditingSlot(null);
    }, [editingSlot, editLabel, bookmarks]);

    const handleClearSlot = useCallback((slot: number) => {
      removePathBookmark(slot);
      setContextMenu(null);
    }, []);

    if (!isOpen) return null;

    const bookmarkMap = new Map(bookmarks.map((b) => [b.slot, b]));

    return (
      <div
        ref={overlayRef}
        style={styles.overlay}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-label="Path Bookmarks"
      >
        <div style={styles.dialog}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.titleRow}>
              {/* Bookmark icon */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--xp-text-secondary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
              </svg>
              <h2 style={styles.title}>Path Bookmarks</h2>
            </div>
            <button
              onClick={onClose}
              style={styles.closeButton}
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
            </button>
          </div>

          {/* Body — 3x3 grid of slots */}
          <div style={styles.body}>
            <div style={styles.grid}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((slot) => {
                const bm = bookmarkMap.get(slot);
                const isHovered = hoveredSlot === slot;
                const isCurrentPath = bm ? bm.path === currentPath : false;
                const displayLabel = bm?.label || (bm ? getFolderName(bm.path) : null);

                return (
                  <div
                    key={slot}
                    style={{
                      ...styles.slot,
                      ...(isHovered ? styles.slotHover : {}),
                      ...(isCurrentPath ? styles.slotActive : {}),
                    }}
                    onClick={() => handleSlotClick(slot)}
                    onContextMenu={(e) => handleSlotRightClick(e, slot)}
                    onMouseEnter={() => setHoveredSlot(slot)}
                    onMouseLeave={() => setHoveredSlot(null)}
                    title={
                      bm
                        ? `Ctrl+${slot}: ${bm.path}`
                        : `Slot ${slot} — click to assign current path`
                    }
                  >
                    {/* Number badge */}
                    <span
                      style={{
                        ...styles.numberBadge,
                        ...(bm ? styles.numberBadgeActive : {}),
                      }}
                    >
                      {slot}
                    </span>

                    {/* Current path indicator */}
                    {isCurrentPath && <span style={styles.currentIndicator} />}

                    {bm ? (
                      <>
                        {/* Icon or folder icon */}
                        <span style={styles.slotIcon}>
                          {bm.icon || (
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="var(--xp-blue)"
                              stroke="none"
                            >
                              <path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" />
                            </svg>
                          )}
                        </span>

                        {/* Label / path */}
                        {editingSlot === slot ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveLabel();
                              if (e.key === 'Escape') setEditingSlot(null);
                              e.stopPropagation();
                            }}
                            onBlur={handleSaveLabel}
                            onClick={(e) => e.stopPropagation()}
                            style={styles.editInput}
                            placeholder="Label..."
                          />
                        ) : (
                          <>
                            <span style={styles.slotLabel}>{displayLabel}</span>
                            <span style={styles.slotPath}>{bm.path}</span>
                          </>
                        )}
                      </>
                    ) : (
                      <span style={styles.slotEmpty}>Empty</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              <span style={styles.kbd}>Ctrl</span>
              <span>+</span>
              <span style={styles.kbd}>1-9</span>
              <span>navigate</span>
              <span style={{ margin: '0 4px', opacity: 0.4 }}>|</span>
              <span style={styles.kbd}>Ctrl</span>
              <span>+</span>
              <span style={styles.kbd}>Shift</span>
              <span>+</span>
              <span style={styles.kbd}>1-9</span>
              <span>assign</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              Press <span style={styles.kbd}>Esc</span> to close
            </span>
          </div>
        </div>

        {/* Context menu */}
        {contextMenu && (
          <div
            style={{
              ...styles.contextMenu,
              left: contextMenu.x,
              top: contextMenu.y,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={styles.contextMenuItem}
              onClick={() => handleAssignCurrent(contextMenu.slot)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--xp-surface-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {/* Pin icon */}
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
                <line x1="12" y1="17" x2="12" y2="22" />
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
              </svg>
              Assign Current Path
            </button>
            {bookmarkMap.has(contextMenu.slot) && (
              <>
                <button
                  style={styles.contextMenuItem}
                  onClick={() => handleEditLabel(contextMenu.slot)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--xp-surface-light)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {/* Pencil icon */}
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
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                  Edit Label
                </button>
                <button
                  style={{
                    ...styles.contextMenuItem,
                    color: 'var(--xp-red, #f87171)',
                  }}
                  onClick={() => handleClearSlot(contextMenu.slot)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--xp-surface-light)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {/* Trash icon */}
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
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                  Clear
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  },
);
PathBookmarksDialog.displayName = 'PathBookmarksDialog';

export default PathBookmarksDialog;
