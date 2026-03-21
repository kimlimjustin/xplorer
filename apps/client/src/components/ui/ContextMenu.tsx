import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileEntry } from '@/lib/tauri-api';
import { SUBMENU_CLOSE_DELAY_MS } from '@/lib/constants';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  action?: () => void;
  visible?: boolean;
}

export interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  onClose: () => void;
  file?: FileEntry;
  selectedFiles?: Set<string>;
  items: ContextMenuItem[];
}

/** Describes an open submenu at a given nesting level. */
interface SubmenuState {
  id: string;
  left: number;
  top: number;
  items: ContextMenuItem[];
}

/** Compute fixed position for a submenu panel relative to its parent item. */
const computeSubmenuPosition = (
  itemEl: HTMLElement,
  subItems: ContextMenuItem[],
): { left: number; top: number } => {
  const parentRect = itemEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const subW = 200;
  const subH = subItems.filter((i) => i.visible !== false).length * 32;

  let left = parentRect.right;
  if (left + subW > vw) left = parentRect.left - subW;
  if (left < 0) left = 0;

  let top = parentRect.top;
  if (top + subH > vh) top = vh - subH - 4;
  if (top < 0) top = 0;

  return { left, top };
};

const ContextMenu = ({ isOpen, x, y, onClose, items }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  // Ref wrapping all menu panels (main + submenus) so mousedown-outside detection works
  const containerRef = useRef<HTMLDivElement>(null);
  // Track a stack of open submenus (supports arbitrary nesting depth)
  const [submenuStack, setSubmenuStack] = useState<SubmenuState[]>([]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset submenu stack when context menu closes
  useEffect(() => {
    if (!isOpen) setSubmenuStack([]);
  }, [isOpen]);

  // Close menu on click outside or Escape
  useEffect(() => {
    if (!isOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      // Check against the container that wraps BOTH main menu and submenu panels
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  // Clamp main menu to viewport
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const adjustedX = Math.max(0, x + rect.width > vw ? vw - rect.width - 10 : x);
      const adjustedY = Math.max(0, y + rect.height > vh ? vh - rect.height - 10 : y);

      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [isOpen, x, y]);

  // Cancel any pending close when entering either a parent item or submenu panel
  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  // Schedule submenu close: collapses all levels at or deeper than `fromLevel`
  const scheduleClose = useCallback(
    (fromLevel: number) => {
      cancelClose();
      closeTimer.current = setTimeout(
        () => setSubmenuStack((prev) => prev.slice(0, fromLevel)),
        SUBMENU_CLOSE_DELAY_MS,
      );
    },
    [cancelClose],
  );

  // Open a submenu at a given nesting level. Collapses any deeper levels.
  const openSubmenuAt = useCallback(
    (level: number, itemId: string, itemEl: HTMLElement, subItems: ContextMenuItem[]) => {
      cancelClose();
      const pos = computeSubmenuPosition(itemEl, subItems);
      setSubmenuStack((prev) => [
        ...prev.slice(0, level),
        { id: itemId, left: pos.left, top: pos.top, items: subItems },
      ]);
    },
    [cancelClose],
  );

  // Close submenus starting from a given level (used when hovering non-submenu items)
  const closeFromLevel = useCallback((level: number) => {
    setSubmenuStack((prev) => (prev.length > level ? prev.slice(0, level) : prev));
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  if (!isOpen) return null;

  /** Render items for a menu panel. `level` determines the submenu depth
   *  (0 = first-level submenu of main menu, 1 = sub-submenu, etc.) */
  const renderMenuItems = (menuItems: ContextMenuItem[], level: number, isMainMenu: boolean) =>
    menuItems.map((item) => {
      if (item.visible === false) return null;
      if (item.separator) {
        return <div key={item.id} className="border-xp-border my-1 border-t" />;
      }

      const hasSubmenu = item.submenu && item.submenu.length > 0;
      const submenuLevel = isMainMenu ? 0 : level + 1;

      return (
        <div
          key={item.id}
          onMouseEnter={(e) => {
            if (hasSubmenu) {
              openSubmenuAt(submenuLevel, item.id, e.currentTarget, item.submenu!);
            } else {
              closeFromLevel(submenuLevel);
            }
          }}
          onMouseLeave={() => {
            if (hasSubmenu) scheduleClose(submenuLevel);
          }}
        >
          <div
            className={`flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm ${
              item.disabled
                ? 'text-xp-text-muted cursor-not-allowed'
                : 'text-xp-text hover:bg-xp-surface-light'
            } `}
            onClick={(e) => {
              e.stopPropagation();
              if (item.disabled) return;
              if (hasSubmenu) {
                openSubmenuAt(submenuLevel, item.id, e.currentTarget.parentElement!, item.submenu!);
              } else {
                try {
                  item.action?.();
                } catch (err) {
                  console.error(`Context menu action "${item.label}" failed:`, err);
                }
                onClose();
              }
            }}
          >
            <div className="flex items-center space-x-2">
              {item.icon && (
                <span className="flex w-4 items-center justify-center text-center">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
            </div>
            <div className="flex items-center space-x-2">
              {item.shortcut && <span className="text-xp-text-muted text-xs">{item.shortcut}</span>}
              {hasSubmenu && (
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
          </div>
        </div>
      );
    });

  return (
    <>
      {/* Container wrapping main menu + all submenu panels (used for mousedown-outside detection) */}
      <div
        ref={containerRef}
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 45 }}
      >
        {/* Main menu */}
        <div
          ref={menuRef}
          className="bg-xp-popover border-xp-border/60 context-menu-scroll fixed z-50 min-w-48 rounded-lg border py-1 shadow-xl shadow-black/20 backdrop-blur-xl"
          style={{ left: x, top: y, maxHeight: '70vh', overflowY: 'auto', pointerEvents: 'auto' }}
        >
          {renderMenuItems(items, 0, true)}
        </div>

        {/* Submenu panels — one per nesting level */}
        {submenuStack.map((sub, idx) => (
          <div
            key={sub.id}
            className="bg-xp-popover border-xp-border/60 context-menu-scroll fixed min-w-48 rounded-lg border py-1 shadow-xl shadow-black/20 backdrop-blur-xl"
            style={{
              left: sub.left,
              top: sub.top,
              maxHeight: '70vh',
              overflowY: 'auto',
              zIndex: 60 + idx,
              pointerEvents: 'auto',
            }}
            onMouseEnter={cancelClose}
            onMouseLeave={() => scheduleClose(idx)}
          >
            {renderMenuItems(sub.items, idx, false)}
          </div>
        ))}
      </div>
    </>
  );
};

// Context menu hook for easier usage
export const useContextMenu = () => {
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    file?: FileEntry;
    selectedFiles?: Set<string>;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
  });

  const openContextMenu = (
    event: React.MouseEvent,
    file?: FileEntry,
    selectedFiles?: Set<string>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      file,
      selectedFiles,
    });
  };

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  };

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu,
  };
};

export default ContextMenu;
