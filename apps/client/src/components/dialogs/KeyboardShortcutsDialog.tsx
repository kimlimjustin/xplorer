import { useState, useEffect, useCallback, useRef } from 'react';
import { TauriAPI, ShortcutBinding } from '@/lib/tauri-api';
import {
  formatKeyComboForDisplay,
  getCategoryForAction,
  getLabelForAction,
} from '@/lib/shortcut-utils';

// ── Category definitions ──────────────────────────────────────────────────────

interface CategoryDef {
  label: string;
  color: string;
}

const CATEGORIES: Record<string, CategoryDef> = {
  'file-operations': { label: 'File Operations', color: 'var(--xp-blue)' },
  navigation: { label: 'Navigation', color: 'var(--xp-green)' },
  selection: { label: 'Selection', color: 'var(--xp-purple)' },
  search: { label: 'Search & Filter', color: 'var(--xp-yellow)' },
  view: { label: 'View & Layout', color: 'var(--xp-cyan, var(--xp-blue))' },
  application: { label: 'Application', color: 'var(--xp-orange, var(--xp-yellow))' },
  terminal: { label: 'Terminal', color: 'var(--xp-green)' },
  extensions: { label: 'Extensions', color: 'var(--xp-purple)' },
};

const CATEGORY_ORDER = Object.keys(CATEGORIES);

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
    maxWidth: '720px',
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
  badge: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--xp-text-secondary)',
    backgroundColor: 'var(--xp-surface-light)',
    padding: '2px 8px',
    borderRadius: '10px',
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
  searchContainer: {
    padding: '12px 20px',
    borderBottom: '1px solid var(--xp-border)',
    flexShrink: 0,
  },
  searchInput: {
    width: '100%',
    height: '36px',
    borderRadius: '8px',
    border: '1px solid var(--xp-border)',
    backgroundColor: 'var(--xp-surface)',
    color: 'var(--xp-text)',
    fontSize: '13px',
    padding: '0 12px 0 36px',
    outline: 'none',
    transition: 'border-color 150ms',
  },
  searchIcon: {
    position: 'absolute' as const,
    left: '32px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--xp-text-secondary)',
    pointerEvents: 'none' as const,
  },
  body: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '8px 20px 20px',
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 0 6px',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  categoryDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  shortcutRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
    borderRadius: '6px',
    transition: 'background-color 150ms',
    gap: '12px',
  },
  shortcutLabel: {
    fontSize: '13px',
    color: 'var(--xp-text)',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },
  keysContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px 7px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--xp-text-secondary)',
    backgroundColor: 'var(--xp-surface-light)',
    border: '1px solid var(--xp-border)',
    borderRadius: '4px',
    minWidth: '22px',
    lineHeight: '18px',
    boxShadow: '0 1px 0 var(--xp-border)',
  },
  kbdPlus: {
    fontSize: '10px',
    color: 'var(--xp-text-secondary)',
    opacity: 0.5,
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '32px 0',
    color: 'var(--xp-text-secondary)',
    fontSize: '13px',
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
  footerHint: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  settingsLink: {
    fontSize: '11px',
    color: 'var(--xp-blue)',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: '4px',
    transition: 'opacity 150ms',
  },
} as const;

// ── Key badge renderer ────────────────────────────────────────────────────────

const KeyBadge = ({ combo }: { combo: string }) => {
  const display = formatKeyComboForDisplay(combo);
  if (!display) return <span style={{ ...styles.kbd, opacity: 0.4 }}>Unbound</span>;

  const parts = display.split(' + ');
  return (
    <span style={styles.keysContainer}>
      {parts.map((part, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          {i > 0 && <span style={styles.kbdPlus}>+</span>}
          <span style={styles.kbd}>{part}</span>
        </span>
      ))}
    </span>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

const KeyboardShortcutsDialog = ({
  isOpen,
  onClose,
  onOpenSettings,
}: KeyboardShortcutsDialogProps) => {
  const [shortcuts, setShortcuts] = useState<ShortcutBinding[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Load shortcuts from the backend
  const loadShortcuts = useCallback(async () => {
    try {
      const data = await TauriAPI.getShortcuts();
      setShortcuts(data);
    } catch (err) {
      console.error('Failed to load shortcuts:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setSearchQuery('');
      loadShortcuts();
    }
  }, [isOpen, loadShortcuts]);

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => searchRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  // Close on click outside
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  // Reload when shortcuts change
  useEffect(() => {
    const handler = () => loadShortcuts();
    window.addEventListener('shortcuts-changed', handler);
    return () => window.removeEventListener('shortcuts-changed', handler);
  }, [loadShortcuts]);

  if (!isOpen) return null;

  // ── Filtering ─────────────────────────────────────────────────────────────

  const query = searchQuery.toLowerCase().trim();

  const getKeyCombo = (s: ShortcutBinding): string =>
    typeof s.key_combination === 'string' ? s.key_combination : '';

  const filtered = shortcuts.filter((s) => {
    if (!s.enabled) return false;
    const combo = getKeyCombo(s);
    if (!combo) return false; // skip unbound shortcuts in the cheat sheet
    if (!query) return true;
    const desc = (s.description || '').toLowerCase();
    const label = getLabelForAction(s.action).toLowerCase();
    const comboDisplay = formatKeyComboForDisplay(combo).toLowerCase();
    return (
      desc.includes(query) ||
      label.includes(query) ||
      comboDisplay.includes(query) ||
      combo.includes(query)
    );
  });

  // ── Grouping ──────────────────────────────────────────────────────────────

  const grouped = new Map<string, ShortcutBinding[]>();
  for (const s of filtered) {
    const cat = s.id.includes('.') ? 'extensions' : getCategoryForAction(s.action);
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(s);
  }

  const sortedCategories = [...grouped.keys()].sort(
    (a, b) =>
      (CATEGORY_ORDER.indexOf(a) === -1 ? 99 : CATEGORY_ORDER.indexOf(a)) -
      (CATEGORY_ORDER.indexOf(b) === -1 ? 99 : CATEGORY_ORDER.indexOf(b)),
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={overlayRef}
      style={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
    >
      <div style={styles.dialog}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.titleRow}>
            {/* Keyboard icon (inline SVG) */}
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
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
              <path d="M6 8h.001" />
              <path d="M10 8h.001" />
              <path d="M14 8h.001" />
              <path d="M18 8h.001" />
              <path d="M8 12h.001" />
              <path d="M12 12h.001" />
              <path d="M16 12h.001" />
              <path d="M7 16h10" />
            </svg>
            <h2 style={styles.title}>Keyboard Shortcuts</h2>
            <span style={styles.badge}>{filtered.length} shortcuts</span>
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

        {/* Search */}
        <div style={{ ...styles.searchContainer, position: 'relative' }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={styles.searchIcon}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shortcuts..."
            style={styles.searchInput}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--xp-blue)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--xp-border)';
            }}
          />
        </div>

        {/* Body */}
        <div style={styles.body}>
          {/* eslint-disable-next-line no-nested-ternary */}
          {isLoading ? (
            <div style={styles.emptyState}>Loading shortcuts...</div>
          ) : filtered.length === 0 ? (
            <div style={styles.emptyState}>
              {searchQuery ? `No shortcuts matching "${searchQuery}"` : 'No shortcuts configured'}
            </div>
          ) : (
            sortedCategories.map((cat) => {
              const def = CATEGORIES[cat] || { label: cat, color: 'var(--xp-text-secondary)' };
              const items = grouped.get(cat)!;

              return (
                <div key={cat}>
                  <div style={styles.categoryHeader}>
                    <span style={{ ...styles.categoryDot, backgroundColor: def.color }} />
                    <span style={{ color: 'var(--xp-text-secondary)' }}>{def.label}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--xp-text-secondary)',
                        opacity: 0.5,
                        marginLeft: 'auto',
                      }}
                    >
                      {items.length}
                    </span>
                  </div>

                  {items.map((shortcut) => {
                    const combo = getKeyCombo(shortcut);
                    const rowId = shortcut.id;
                    const isHovered = hoveredRow === rowId;

                    return (
                      <div
                        key={rowId}
                        style={{
                          ...styles.shortcutRow,
                          backgroundColor: isHovered ? 'var(--xp-surface-light)' : 'transparent',
                        }}
                        onMouseEnter={() => setHoveredRow(rowId)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        <span style={styles.shortcutLabel}>
                          {shortcut.description || getLabelForAction(shortcut.action)}
                        </span>
                        <KeyBadge combo={combo} />
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.footerHint}>
            Press <span style={{ ...styles.kbd, fontSize: '10px', padding: '1px 5px' }}>Esc</span>{' '}
            to close
          </span>
          {onOpenSettings && (
            <button
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              style={styles.settingsLink}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              Customize in Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsDialog;
