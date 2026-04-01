import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown, ChevronRight, GripHorizontal } from 'lucide-react';
import {
  getAllCollections,
  deleteCollection,
  isSmartFolder,
  type FileCollection,
} from '@/lib/collections';
import { renderIcon } from '@/lib/utils';
import { useWindowEvent } from '@/hooks/use-window-event';
import { useTranslation } from 'react-i18next';

interface SidebarCollectionsProps {
  currentPath: string;
  navigateToPath: (path: string) => void;
  activeCollectionFilter?: FileCollection | null;
  onToggleCollectionFilter?: (collection: FileCollection) => void;
  onCreateCollection?: () => void;
  onEditCollection?: (collection: FileCollection) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  sectionHeight: number | undefined;
  onResizeStart: (sectionId: string, e: React.MouseEvent) => void;
}

const SidebarCollections = ({
  currentPath,
  navigateToPath,
  activeCollectionFilter,
  onToggleCollectionFilter,
  onCreateCollection,
  onEditCollection,
  collapsed,
  onToggleCollapsed,
  sectionHeight,
  onResizeStart,
}: SidebarCollectionsProps) => {
  const { t } = useTranslation();
  const [collections, setCollections] = useState<FileCollection[]>([]);
  const [collectionContextMenu, setCollectionContextMenu] = useState<{
    x: number;
    y: number;
    collection: FileCollection;
  } | null>(null);

  useEffect(() => {
    setCollections(getAllCollections());
  }, []);

  useWindowEvent('collections-changed', () => setCollections(getAllCollections()));

  useEffect(() => {
    if (!collectionContextMenu) return;
    const close = () => setCollectionContextMenu(null);
    document.addEventListener('click', close, { once: true });
    return () => document.removeEventListener('click', close);
  }, [collectionContextMenu]);

  return (
    <>
      <div
        className="border-xp-border border-b"
        role="region"
        aria-label="Collections"
        data-sidebar-section="collections"
      >
        <div className="flex items-center justify-between">
          <button
            className="text-xp-text-muted hover:bg-xp-surface-light/50 flex flex-1 items-center px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label="Toggle collections"
          >
            {collapsed ? (
              <ChevronRight className="mr-1 h-3 w-3 flex-shrink-0" />
            ) : (
              <ChevronDown className="mr-1 h-3 w-3 flex-shrink-0" />
            )}
            {t('sidebar.collections')}
          </button>
          {onCreateCollection && !collapsed && (
            <button
              onClick={onCreateCollection}
              className="text-xp-text-muted hover:text-xp-blue mr-2 transition-colors"
              title="Create new collection"
              aria-label="Create new collection"
              style={{ padding: '2px' }}
            >
              <Plus size={13} />
            </button>
          )}
        </div>
        {!collapsed && (
          <div
            className="space-y-0.5 overflow-y-auto px-3 pb-2"
            style={sectionHeight ? { maxHeight: sectionHeight } : undefined}
          >
            {collections.length === 0 ? (
              <p className="text-xp-text-secondary py-1 text-xs">{t('sidebar.noCollections')}</p>
            ) : (
              collections.map((col) => {
                const smartFolder = isSmartFolder(col);
                const isActive = smartFolder
                  ? currentPath === `collection://${col.id}`
                  : activeCollectionFilter?.id === col.id;
                return (
                  <div
                    key={col.id}
                    className={`group flex w-full cursor-pointer items-center rounded px-2 py-1 text-xs transition-colors ${
                      isActive ? 'text-xp-text' : 'hover:bg-xp-surface-light text-xp-text'
                    }`}
                    style={{
                      borderLeft: (() => {
                        if (isActive && !smartFolder) return `3px solid ${col.color}`;
                        if (isActive && smartFolder) return '3px solid var(--xp-blue)';
                        return '3px solid transparent';
                      })(),
                      backgroundColor: (() => {
                        if (!isActive) return undefined;
                        return smartFolder ? 'rgba(122,162,247,0.15)' : `${col.color}15`;
                      })(),
                    }}
                    onClick={() => {
                      if (smartFolder) {
                        navigateToPath(`collection://${col.id}`);
                      } else {
                        onToggleCollectionFilter?.(col);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!col.builtin) {
                        setCollectionContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          collection: col,
                        });
                      }
                    }}
                    title={`${col.name} - ${col.filters.length} filter${col.filters.length !== 1 ? 's' : ''}${smartFolder ? ' (smart folder)' : ' (quick filter)'}`}
                  >
                    <span className="mr-2 flex-shrink-0 text-sm" aria-hidden="true">
                      {renderIcon(col.icon, 14)}
                    </span>
                    <span className="flex-1 truncate">{col.name}</span>
                    {isActive && !smartFolder && (
                      <span
                        className="ml-auto flex-shrink-0"
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: col.color,
                        }}
                      />
                    )}
                    {smartFolder && (
                      <span
                        className="text-xp-text-muted bg-xp-surface ml-auto flex-shrink-0 rounded-full px-1.5 py-0 text-[10px]"
                        style={{ minWidth: '18px', textAlign: 'center' }}
                      >
                        {col.filters.length}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
        {/* Resize handle */}
        {!collapsed && (
          <div
            className="hover:bg-xp-blue/30 group flex h-2 cursor-row-resize items-center justify-center transition-colors"
            onMouseDown={(e) => onResizeStart('collections', e)}
          >
            <GripHorizontal className="text-xp-text-muted/20 group-hover:text-xp-text-muted/60 h-3 w-4 transition-colors" />
          </div>
        )}
      </div>

      {/* Collection context menu (inline) */}
      {collectionContextMenu && (
        <div
          style={{
            position: 'fixed',
            left: collectionContextMenu.x,
            top: collectionContextMenu.y,
            zIndex: 9999,
            minWidth: '120px',
            borderRadius: '8px',
            backgroundColor: 'var(--xp-surface)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--xp-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            padding: '4px',
            animation: 'fadeIn 100ms ease-out',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="text-xp-text hover:bg-xp-surface-light flex w-full items-center rounded px-3 py-1.5 text-xs transition-colors"
            onClick={() => {
              if (onEditCollection) onEditCollection(collectionContextMenu.collection);
              setCollectionContextMenu(null);
            }}
          >
            Edit
          </button>
          <button
            className="text-xp-red hover:bg-xp-surface-light flex w-full items-center rounded px-3 py-1.5 text-xs transition-colors"
            onClick={() => {
              deleteCollection(collectionContextMenu.collection.id);
              setCollectionContextMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </>
  );
};

export default SidebarCollections;
