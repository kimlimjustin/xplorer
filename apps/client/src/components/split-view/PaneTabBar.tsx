import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  FolderClosed,
  File,
  FileCode,
  GitCompareArrows,
  Cloud,
  Plus,
  X,
  Columns,
  Rows,
  Pin,
  Maximize2,
  Minimize2,
  Link,
  Unlink,
} from 'lucide-react';
import type { TabItem } from '@/types/split-view';
import type { CrossTabSelection } from '@/hooks/use-cross-tab-selection';
import { useCrossTabSelectionContext } from '@/contexts/CrossTabSelectionContext';
import type { PaneSyncMode } from '@/hooks/use-pane-sync';

interface PaneTabBarProps {
  groupId: string;
  tabs: TabItem[];
  activeTabId: string;
  isActiveGroup: boolean;
  canClose: boolean;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onAddTab: () => void;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
  onCloseGroup: () => void;
  onFocus: () => void;
  onTogglePin?: (tabId: string) => void;
  onDuplicateTab?: (tabId: string) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseTabsToRight?: (tabId: string) => void;
  onCloseAllTabs?: () => void;
  onReorderTab?: (fromIndex: number, toIndex: number) => void;
  /** Whether this pane is currently maximized */
  isMaximized?: boolean;
  onMaximizePane?: () => void;
  onRestorePane?: () => void;
  /** Cross-tab selection data — used for badge indicators and drop targets */
  crossTabSelections?: Map<string, CrossTabSelection>;
  /** Called when files are dropped onto a tab header */
  onCrossTabDrop?: (targetTabPath: string, sourceFiles: { path: string; name: string }[]) => void;
  /** Pane sync navigation state */
  paneSyncEnabled?: boolean;
  paneSyncMode?: PaneSyncMode;
  onTogglePaneSync?: () => void;
  onSwitchPaneSyncMode?: (mode: PaneSyncMode) => void;
  /** Whether there are multiple panes (sync button only shows when true) */
  hasMultiplePanes?: boolean;
}

const getTabIcon = (tab: TabItem) => {
  switch (tab.type) {
    case 'editor':
      return FileCode;
    case 'comparison':
      return GitCompareArrows;
    case 'gdrive':
    case 'gdrive-manager':
      return Cloud;
    case 'folder':
      return FolderClosed;
    default:
      return File;
  }
}

// ── Context Menu ──────────────────────────────────────────────────────────────

interface ContextMenuState {
  tabId: string;
  x: number;
  y: number;
}

const TabContextMenu = ({
  menu,
  tab,
  tabs,
  onClose,
  onTogglePin,
  onDuplicateTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseAllTabs,
}: {
  menu: ContextMenuState;
  tab: TabItem;
  tabs: TabItem[];
  onClose: () => void;
  onTogglePin?: (tabId: string) => void;
  onDuplicateTab?: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseTabsToRight?: (tabId: string) => void;
  onCloseAllTabs?: () => void;
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Adjust position so menu doesn't overflow viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) {
      menuRef.current.style.left = `${menu.x - rect.width}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${menu.y - rect.height}px`;
    }
  }, [menu.x, menu.y]);

  const tabIndex = tabs.findIndex((t) => t.id === tab.id);
  const hasTabsToRight = tabs.slice(tabIndex + 1).some((t) => !t.isPinned);
  const hasOtherTabs = tabs.filter((t) => t.id !== tab.id && !t.isPinned).length > 0;

  const items: { label: string; action: () => void; disabled?: boolean; separator?: boolean }[] = [
    {
      label: tab.isPinned ? 'Unpin Tab' : 'Pin Tab',
      action: () => {
        onTogglePin?.(tab.id);
        onClose();
      },
    },
    {
      label: 'Duplicate Tab',
      action: () => {
        onDuplicateTab?.(tab.id);
        onClose();
      },
    },
    {
      label: 'Close Tab',
      action: () => {
        onCloseTab(tab.id);
        onClose();
      },
      disabled: !!tab.isPinned,
      separator: true,
    },
    {
      label: 'Close Other Tabs',
      action: () => {
        onCloseOtherTabs?.(tab.id);
        onClose();
      },
      disabled: !hasOtherTabs,
    },
    {
      label: 'Close Tabs to the Right',
      action: () => {
        onCloseTabsToRight?.(tab.id);
        onClose();
      },
      disabled: !hasTabsToRight,
    },
    {
      label: 'Close All Tabs',
      action: () => {
        onCloseAllTabs?.();
        onClose();
      },
    },
  ];

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: menu.y,
    left: menu.x,
    zIndex: 9999,
    minWidth: 180,
    background: 'var(--xp-surface)',
    border: '1px solid var(--xp-border)',
    borderRadius: 6,
    padding: '4px 0',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(12px)',
  };

  const itemBaseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    fontSize: 12,
    color: 'var(--xp-text)',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    width: '100%',
    textAlign: 'left',
  };

  const disabledStyle: React.CSSProperties = {
    ...itemBaseStyle,
    color: 'var(--xp-text-muted)',
    cursor: 'default',
    opacity: 0.5,
  };

  const separatorStyle: React.CSSProperties = {
    height: 1,
    background: 'var(--xp-border)',
    margin: '4px 8px',
  };

  return (
    <div ref={menuRef} style={menuStyle}>
      {items.map((item, _i) => (
        <React.Fragment key={item.label}>
          <button
            style={item.disabled ? disabledStyle : itemBaseStyle}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                (e.currentTarget as HTMLElement).style.background = 'var(--xp-surface-light)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
            onClick={item.disabled ? undefined : item.action}
            disabled={item.disabled}
          >
            {item.label}
          </button>
          {item.separator && <div style={separatorStyle} />}
        </React.Fragment>
      ))}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const PaneTabBar = ({
  groupId: _groupId,
  tabs,
  activeTabId,
  isActiveGroup,
  canClose,
  onSwitchTab,
  onCloseTab,
  onAddTab,
  onSplitHorizontal,
  onSplitVertical,
  onCloseGroup,
  onFocus,
  onTogglePin,
  onDuplicateTab,
  onCloseOtherTabs,
  onCloseTabsToRight,
  onCloseAllTabs,
  onReorderTab,
  isMaximized,
  onMaximizePane,
  onRestorePane,
  crossTabSelections,
  onCrossTabDrop,
  paneSyncEnabled,
  paneSyncMode,
  onTogglePaneSync,
  onSwitchPaneSyncMode,
  hasMultiplePanes,
}: PaneTabBarProps) => {
  // Maximize/restore toggle
  const handleToggleMaximize = useCallback(() => {
    if (isMaximized) {
      onRestorePane?.();
    } else {
      onMaximizePane?.();
    }
  }, [isMaximized, onMaximizePane, onRestorePane]);

  // Cross-tab selection: prefer prop, fallback to context
  const ctxCrossTab = useCrossTabSelectionContext();
  const effectiveCrossTabSelections = useMemo(
    () => crossTabSelections ?? ctxCrossTab?.selections ?? new Map<string, CrossTabSelection>(),
    [crossTabSelections, ctxCrossTab?.selections],
  );

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Drag-to-reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const tabRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Cross-tab file drop state: which tab is being hovered with external files
  const [crossTabDropTarget, setCrossTabDropTarget] = useState<string | null>(null);

  // Check if a tab has a cross-tab selection (by matching tab path)
  const tabHasCrossTabSelection = useCallback(
    (tab: TabItem) => {
      if (!effectiveCrossTabSelections || effectiveCrossTabSelections.size === 0) return false;
      for (const sel of effectiveCrossTabSelections.values()) {
        if (sel.tabPath === tab.path && sel.files.length > 0) return true;
      }
      return false;
    },
    [effectiveCrossTabSelections],
  );

  // Cross-tab file drop handlers for individual tab headers
  const handleCrossTabDragOver = useCallback((e: React.DragEvent, tabId: string) => {
    // Only react if we have cross-tab data in the drag
    if (e.dataTransfer.types.includes('application/x-xplorer-cross-tab-files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setCrossTabDropTarget(tabId);
    }
  }, []);

  const handleCrossTabDragLeave = useCallback((_e: React.DragEvent, tabId: string) => {
    setCrossTabDropTarget((prev) => (prev === tabId ? null : prev));
  }, []);

  const handleCrossTabFileDrop = useCallback(
    (e: React.DragEvent, tab: TabItem) => {
      setCrossTabDropTarget(null);
      const raw = e.dataTransfer.getData('application/x-xplorer-cross-tab-files');
      if (!raw) return;
      try {
        const files = JSON.parse(raw) as { path: string; name: string }[];
        if (files.length > 0 && onCrossTabDrop) {
          onCrossTabDrop(tab.path, files);
        }
      } catch {
        /* ignore bad data */
      }
    },
    [onCrossTabDrop],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Sort tabs: pinned first, then unpinned (preserving relative order within each group)
  const sortedTabs = React.useMemo(() => {
    const pinned = tabs.filter((t) => t.isPinned);
    const unpinned = tabs.filter((t) => !t.isPinned);
    return [...pinned, ...unpinned];
  }, [tabs]);

  const pinnedCount = sortedTabs.filter((t) => t.isPinned).length;

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    // Make the drag ghost semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragIndex === null) return;

      // Enforce pinned/unpinned boundary:
      // A pinned tab can only be dropped among pinned tabs (0..pinnedCount-1)
      // An unpinned tab can only be dropped among unpinned tabs (pinnedCount..end)
      const isDraggingPinned = sortedTabs[dragIndex]?.isPinned;
      if (isDraggingPinned && index >= pinnedCount) return;
      if (!isDraggingPinned && index < pinnedCount) return;

      setDropIndex(index);
    },
    [dragIndex, pinnedCount, sortedTabs],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === toIndex) {
        setDragIndex(null);
        setDropIndex(null);
        return;
      }

      // Enforce boundary
      const isDraggingPinned = sortedTabs[dragIndex]?.isPinned;
      if (isDraggingPinned && toIndex >= pinnedCount) return;
      if (!isDraggingPinned && toIndex < pinnedCount) return;

      // Map sorted indices back to original tab array indices
      const fromTab = sortedTabs[dragIndex];
      const toTab = sortedTabs[toIndex];
      const origFrom = tabs.findIndex((t) => t.id === fromTab.id);
      const origTo = tabs.findIndex((t) => t.id === toTab.id);

      if (origFrom >= 0 && origTo >= 0) {
        onReorderTab?.(origFrom, origTo);
      }

      setDragIndex(null);
      setDropIndex(null);
    },
    [dragIndex, pinnedCount, sortedTabs, tabs, onReorderTab],
  );

  // Pin icon style
  const pinIconStyle: React.CSSProperties = {
    width: 10,
    height: 10,
    marginRight: 3,
    flexShrink: 0,
    transform: 'rotate(-45deg)',
    color: 'var(--xp-blue)',
  };

  // Drop indicator style
  const dropIndicatorStyle: React.CSSProperties = {
    position: 'absolute',
    top: 2,
    bottom: 2,
    width: 2,
    background: 'var(--xp-blue)',
    borderRadius: 1,
    zIndex: 10,
    pointerEvents: 'none',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: `1px solid ${isActiveGroup ? 'var(--xp-blue)' : 'var(--xp-border)'}`,
        flexShrink: 0,
        background: 'var(--xp-surface)',
      }}
      onMouseDown={onFocus}
      onDoubleClick={(e) => {
        // Only toggle on double-click of the bar background, not on tab items or buttons
        if (
          (e.target as HTMLElement).closest('button') ||
          (e.target as HTMLElement).closest('[data-tab-item]')
        )
          return;
        handleToggleMaximize();
      }}
    >
      {/* Tabs */}
      <div style={{ flex: 1, display: 'flex', overflowX: 'auto', minWidth: 0 }}>
        {sortedTabs.map((tab, index) => {
          const TabIcon = getTabIcon(tab);
          const isActive = activeTabId === tab.id;
          const isPinned = !!tab.isPinned;
          const isDropTarget = dropIndex === index && dragIndex !== null && dragIndex !== index;
          const isBeingDragged = dragIndex === index;
          const hasCrossSelection = tabHasCrossTabSelection(tab);
          const isCrossDropTarget = crossTabDropTarget === tab.id;

          return (
            <div
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              data-tab-item
              data-drop-target={
                tab.type === 'folder' && tab.path && !tab.path.startsWith('xplorer://')
                  ? tab.path
                  : undefined
              }
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => {
                handleDragOver(e, index);
                handleCrossTabDragOver(e, tab.id);
              }}
              onDragLeave={(e) => handleCrossTabDragLeave(e, tab.id)}
              onDrop={(e) => {
                handleDrop(e, index);
                handleCrossTabFileDrop(e, tab);
              }}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              onClick={() => onSwitchTab(tab.id)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                padding: isPinned ? '6px 8px' : '6px 12px',
                borderRight: '1px solid var(--xp-border)',
                cursor: 'pointer',
                minWidth: 0,
                maxWidth: isPinned ? 120 : 180,
                userSelect: 'none',
                background: isCrossDropTarget
                  ? 'color-mix(in srgb, var(--xp-blue) 20%, var(--xp-surface))'
                  : isActive
                    ? 'var(--xp-bg)'
                    : isPinned
                      ? 'color-mix(in srgb, var(--xp-blue) 8%, var(--xp-surface))'
                      : 'transparent',
                borderBottom: isCrossDropTarget
                  ? '2px solid var(--xp-blue)'
                  : isActive
                    ? '2px solid var(--xp-blue)'
                    : '2px solid transparent',
                outline: isCrossDropTarget ? '1px dashed var(--xp-blue)' : 'none',
                outlineOffset: -1,
                opacity: isBeingDragged ? 0.5 : 1,
                transition: 'background 0.15s ease, outline 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = isPinned
                    ? 'color-mix(in srgb, var(--xp-blue) 12%, var(--xp-surface-light))'
                    : 'var(--xp-surface-light)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = isPinned
                    ? 'color-mix(in srgb, var(--xp-blue) 8%, var(--xp-surface))'
                    : 'transparent';
                }
              }}
            >
              {/* Drop indicator - left edge */}
              {isDropTarget && dragIndex !== null && dragIndex > index && (
                <div style={{ ...dropIndicatorStyle, left: -1 }} />
              )}
              {/* Drop indicator - right edge */}
              {isDropTarget && dragIndex !== null && dragIndex < index && (
                <div style={{ ...dropIndicatorStyle, right: -1 }} />
              )}

              {/* Pin icon for pinned tabs */}
              {isPinned && <Pin size={10} style={pinIconStyle} />}

              <TabIcon
                size={13}
                style={{
                  marginRight: 6,
                  flexShrink: 0,
                  color: 'var(--xp-text-secondary)',
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'var(--xp-text)',
                }}
              >
                {tab.name}
              </span>

              {/* Cross-tab selection badge */}
              {hasCrossSelection && (
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--xp-blue)',
                    flexShrink: 0,
                    marginLeft: 4,
                    boxShadow: '0 0 4px var(--xp-blue)',
                  }}
                  title="Has files selected for cross-tab operations"
                />
              )}

              {/* Close button: hidden on pinned tabs */}
              {!isPinned && tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  style={{
                    marginLeft: 4,
                    padding: 2,
                    borderRadius: 3,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'var(--xp-text-muted)',
                    opacity: 0,
                    transition: 'opacity 0.1s',
                  }}
                  className="tab-close-btn"
                  aria-label={`Close ${tab.name}`}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--xp-surface-light)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--xp-text)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--xp-text-muted)';
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div
        style={{ display: 'flex', alignItems: 'center', flexShrink: 0, padding: '0 4px', gap: 2 }}
      >
        <button
          onClick={onAddTab}
          style={{
            padding: 4,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--xp-text-muted)',
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--xp-surface-light)';
            (e.currentTarget as HTMLElement).style.color = 'var(--xp-text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--xp-text-muted)';
          }}
          title="New tab"
        >
          <Plus size={14} />
        </button>
        {/* Sync navigation toggle — only shown when multiple panes exist */}
        {hasMultiplePanes && onTogglePaneSync && (
          <button
            onClick={onTogglePaneSync}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onSwitchPaneSyncMode) {
                onSwitchPaneSyncMode(paneSyncMode === 'mirror' ? 'relative' : 'mirror');
              }
            }}
            style={{
              padding: 4,
              borderRadius: 4,
              border: paneSyncEnabled ? '1px solid var(--xp-blue)' : 'none',
              background: paneSyncEnabled
                ? 'color-mix(in srgb, var(--xp-blue) 15%, transparent)'
                : 'transparent',
              cursor: 'pointer',
              color: paneSyncEnabled ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = paneSyncEnabled
                ? 'color-mix(in srgb, var(--xp-blue) 25%, transparent)'
                : 'var(--xp-surface-light)';
              (e.currentTarget as HTMLElement).style.color = 'var(--xp-blue)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = paneSyncEnabled
                ? 'color-mix(in srgb, var(--xp-blue) 15%, transparent)'
                : 'transparent';
              (e.currentTarget as HTMLElement).style.color = paneSyncEnabled
                ? 'var(--xp-blue)'
                : 'var(--xp-text-muted)';
            }}
            title={
              paneSyncEnabled
                ? `Sync Navigation ON (${paneSyncMode === 'mirror' ? 'Mirror' : 'Relative'}) — Click to disable, Right-click to switch mode`
                : 'Sync Navigation OFF — Click to enable, Right-click to switch mode'
            }
          >
            {paneSyncEnabled ? <Link size={14} /> : <Unlink size={14} />}
          </button>
        )}
        <button
          onClick={onSplitHorizontal}
          style={{
            padding: 4,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--xp-text-muted)',
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--xp-surface-light)';
            (e.currentTarget as HTMLElement).style.color = 'var(--xp-text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--xp-text-muted)';
          }}
          title="Split right"
        >
          <Columns size={14} />
        </button>
        <button
          onClick={onSplitVertical}
          style={{
            padding: 4,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--xp-text-muted)',
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--xp-surface-light)';
            (e.currentTarget as HTMLElement).style.color = 'var(--xp-text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--xp-text-muted)';
          }}
          title="Split down"
        >
          <Rows size={14} />
        </button>
        {canClose && (
          <button
            onClick={handleToggleMaximize}
            style={{
              padding: 4,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: isMaximized ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--xp-surface-light)';
              (e.currentTarget as HTMLElement).style.color = 'var(--xp-blue)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = isMaximized
                ? 'var(--xp-blue)'
                : 'var(--xp-text-muted)';
            }}
            title={isMaximized ? 'Restore pane' : 'Maximize pane'}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        )}
        {canClose && (
          <button
            onClick={onCloseGroup}
            style={{
              padding: 4,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--xp-text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(239, 68, 68, 0.2)';
              (e.currentTarget as HTMLElement).style.color = 'var(--xp-red)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--xp-text-muted)';
            }}
            title="Close pane"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Context menu */}
      {contextMenu &&
        (() => {
          const ctxTab = tabs.find((t) => t.id === contextMenu.tabId);
          if (!ctxTab) return null;
          return (
            <TabContextMenu
              menu={contextMenu}
              tab={ctxTab}
              tabs={tabs}
              onClose={closeContextMenu}
              onTogglePin={onTogglePin}
              onDuplicateTab={onDuplicateTab}
              onCloseTab={onCloseTab}
              onCloseOtherTabs={onCloseOtherTabs}
              onCloseTabsToRight={onCloseTabsToRight}
              onCloseAllTabs={onCloseAllTabs}
            />
          );
        })()}

      {/* Inline style for the close button hover reveal */}
      <style>{`
        div:hover > .tab-close-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}

export default PaneTabBar;
