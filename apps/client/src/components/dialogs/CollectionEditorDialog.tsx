import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { FileEntry } from '@/lib/tauri-api';
import {
  type FileCollection,
  type CollectionFilter,
  FILTER_TYPES,
  COLLECTION_ICONS,
  COLLECTION_COLORS,
  filterTypeLabel,
  filterValuePlaceholder,
  matchesFilter,
  createCollection,
  updateCollection,
} from '@/lib/collections';
import { renderIcon } from '@/lib/utils';

// ── Inline styles (CSS-variable driven) ──────────────────────────────────────

const S = {
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
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--xp-text)',
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--xp-text-muted)',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '18px',
    lineHeight: 1,
  },
  body: {
    padding: '16px 20px',
    overflowY: 'auto' as const,
    flex: '1 1 auto',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--xp-text-secondary)',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--xp-border)',
    backgroundColor: 'var(--xp-surface)',
    color: 'var(--xp-text)',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  iconRow: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap' as const,
  },
  iconBtn: (selected: boolean) => ({
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    borderRadius: '8px',
    border: selected ? '2px solid var(--xp-blue)' : '1px solid var(--xp-border)',
    backgroundColor: selected
      ? 'var(--xp-blue-alpha, rgba(122, 162, 247, 0.15))'
      : 'var(--xp-surface)',
    cursor: 'pointer',
    transition: 'all 120ms ease',
  }),
  colorBtn: (hexColor: string, selected: boolean) => ({
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: selected ? '2px solid var(--xp-text)' : '2px solid transparent',
    backgroundColor: hexColor,
    cursor: 'pointer',
    transition: 'all 120ms ease',
    outline: selected ? `2px solid ${hexColor}` : 'none',
    outlineOffset: '2px',
  }),
  section: {
    marginBottom: '16px',
  },
  filterRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '8px',
  },
  select: {
    flex: '0 0 170px',
    padding: '7px 10px',
    borderRadius: '8px',
    border: '1px solid var(--xp-border)',
    backgroundColor: 'var(--xp-surface)',
    color: 'var(--xp-text)',
    fontSize: '12px',
    outline: 'none',
  },
  filterInput: {
    flex: 1,
    padding: '7px 10px',
    borderRadius: '8px',
    border: '1px solid var(--xp-border)',
    backgroundColor: 'var(--xp-surface)',
    color: 'var(--xp-text)',
    fontSize: '12px',
    outline: 'none',
    minWidth: 0,
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--xp-red, #f7768e)',
    cursor: 'pointer',
    fontSize: '16px',
    lineHeight: 1,
    padding: '4px 6px',
    borderRadius: '6px',
    flexShrink: 0,
  },
  addBtn: {
    background: 'none',
    border: '1px dashed var(--xp-border)',
    color: 'var(--xp-blue)',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '6px 14px',
    borderRadius: '8px',
    fontWeight: 500,
  },
  previewBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    backgroundColor: 'var(--xp-surface-light, var(--xp-surface))',
    border: '1px solid var(--xp-border)',
    fontSize: '12px',
    color: 'var(--xp-text-secondary)',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '12px 20px',
    borderTop: '1px solid var(--xp-border)',
    flexShrink: 0,
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid var(--xp-border)',
    backgroundColor: 'transparent',
    color: 'var(--xp-text)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  saveBtn: {
    padding: '8px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--xp-blue)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
  },
  saveBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
} as const;

// ── Props ────────────────────────────────────────────────────────────────────

interface CollectionEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** If provided, we're editing an existing collection. Otherwise creating new. */
  collection?: FileCollection | null;
  /** Current directory files for live preview count. */
  currentFiles?: FileEntry[];
  /** Current path for the basePath default. */
  currentPath?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

const CollectionEditorDialogInner = ({
  isOpen,
  onClose,
  collection,
  currentFiles = [],
  currentPath = '',
}: CollectionEditorDialogProps) => {
  const isEditing = !!collection;

  const [name, setName] = useState(collection?.name ?? '');
  const [icon, setIcon] = useState(collection?.icon ?? COLLECTION_ICONS[0]);
  const [color, setColor] = useState(collection?.color ?? COLLECTION_COLORS[3]);
  const [filters, setFilters] = useState<CollectionFilter[]>(
    collection?.filters ?? [{ type: 'extension', value: '' }],
  );
  const [basePath, setBasePath] = useState(collection?.basePath ?? currentPath);

  // Reset form when collection prop changes
  useEffect(() => {
    if (collection) {
      setName(collection.builtin ? '' : collection.name);
      setIcon(collection.icon);
      setColor(collection.color ?? COLLECTION_COLORS[3]);
      setFilters(
        collection.filters.length > 0
          ? [...collection.filters]
          : [{ type: 'extension', value: '' }],
      );
      setBasePath(collection.basePath);
    } else {
      setName('');
      setIcon(COLLECTION_ICONS[0]);
      setColor(COLLECTION_COLORS[3]);
      setFilters([{ type: 'extension', value: '' }]);
      setBasePath(currentPath);
    }
  }, [collection, currentPath]);

  // Live preview: count files matching current filters
  const matchCount = useMemo(() => {
    if (currentFiles.length === 0) return 0;
    const validFilters = filters.filter((f) => f.value.trim() !== '');
    if (validFilters.length === 0) return currentFiles.length;
    return currentFiles.filter((file) => validFilters.every((f) => matchesFilter(file, f))).length;
  }, [currentFiles, filters]);

  const handleFilterTypeChange = useCallback((idx: number, newType: CollectionFilter['type']) => {
    setFilters((prev) => {
      const next = [...prev];
      next[idx] = { type: newType, value: '' };
      return next;
    });
  }, []);

  const handleFilterValueChange = useCallback((idx: number, value: string) => {
    setFilters((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], value };
      return next;
    });
  }, []);

  const addFilter = useCallback(() => {
    setFilters((prev) => [...prev, { type: 'extension', value: '' }]);
  }, []);

  const removeFilter = useCallback((idx: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const canSave = name.trim().length > 0 && filters.some((f) => f.value.trim() !== '');

  const handleSave = () => {
    if (!canSave) return;
    const cleanFilters = filters.filter((f) => f.value.trim() !== '');
    if (isEditing && collection) {
      updateCollection(collection.id, {
        name: name.trim(),
        icon,
        color,
        filters: cleanFilters,
        basePath,
      });
    } else {
      createCollection(name.trim(), cleanFilters, icon, basePath, color);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canSave) {
      e.preventDefault();
      handleSave();
    }
  };

  if (!isOpen) return null;

  const getPlaceholder = (type: CollectionFilter['type']): string => {
    return filterValuePlaceholder(type);
  };

  const getInputType = (type: CollectionFilter['type']): string => {
    if (type === 'modified_after' || type === 'modified_before') return 'date';
    if (type === 'size_gt' || type === 'size_lt') return 'number';
    return 'text';
  };

  return (
    <div
      style={S.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        style={S.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Edit Collection' : 'New Collection'}
      >
        {/* Header */}
        <div style={S.header}>
          <h2 style={S.title}>{isEditing ? 'Edit Collection' : 'New Collection'}</h2>
          <button style={S.closeBtn} onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {/* Name */}
          <div style={S.section}>
            <label style={S.label}>Name</label>
            <input
              style={S.input}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Collection"
              autoFocus
            />
          </div>

          {/* Icon */}
          <div style={S.section}>
            <label style={S.label}>Icon</label>
            <div style={S.iconRow}>
              {COLLECTION_ICONS.map((ic) => (
                <button
                  key={ic}
                  style={S.iconBtn(icon === ic)}
                  onClick={() => setIcon(ic)}
                  aria-label={`Select icon ${ic}`}
                  type="button"
                >
                  {renderIcon(ic, 16)}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div style={S.section}>
            <label style={S.label}>Color</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {COLLECTION_COLORS.map((c) => (
                <button
                  key={c}
                  style={S.colorBtn(c, color === c)}
                  onClick={() => setColor(c)}
                  aria-label={`Select color ${c}`}
                  type="button"
                />
              ))}
            </div>
          </div>

          {/* Base path */}
          <div style={S.section}>
            <label style={S.label}>Base Directory (optional)</label>
            <input
              style={S.input}
              type="text"
              value={basePath}
              onChange={(e) => setBasePath(e.target.value)}
              placeholder="Leave empty to use as quick filter on current directory"
            />
            <div style={{ fontSize: '11px', color: 'var(--xp-text-muted)', marginTop: '4px' }}>
              {basePath
                ? 'Smart folder: navigates to this directory with filters applied.'
                : 'Quick filter: applies filters to whatever directory you are viewing.'}
            </div>
          </div>

          {/* Filters */}
          <div style={S.section}>
            <label style={S.label}>Filters</label>
            {filters.map((filter, idx) => (
              // eslint-disable-next-line react/no-array-index-key
              <div style={S.filterRow} key={idx}>
                <select
                  style={S.select}
                  value={filter.type}
                  onChange={(e) =>
                    handleFilterTypeChange(idx, e.target.value as CollectionFilter['type'])
                  }
                >
                  {FILTER_TYPES.map((ft) => (
                    <option key={ft} value={ft}>
                      {filterTypeLabel(ft)}
                    </option>
                  ))}
                </select>
                {filter.type === 'is_directory' || filter.type === 'is_hidden' ? (
                  <select
                    style={{ ...S.filterInput, flex: 1 }}
                    value={filter.value}
                    onChange={(e) => handleFilterValueChange(idx, e.target.value)}
                  >
                    <option value="">-- select --</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input
                    style={S.filterInput}
                    type={getInputType(filter.type)}
                    value={filter.value}
                    onChange={(e) => handleFilterValueChange(idx, e.target.value)}
                    placeholder={getPlaceholder(filter.type)}
                  />
                )}
                <button
                  style={S.removeBtn}
                  onClick={() => removeFilter(idx)}
                  aria-label="Remove filter"
                  type="button"
                  title="Remove this filter"
                >
                  &times;
                </button>
              </div>
            ))}
            <button style={S.addBtn} onClick={addFilter} type="button">
              + Add Filter
            </button>
          </div>

          {/* Preview count */}
          <div style={S.section}>
            <div style={S.previewBadge}>
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
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <span>
                <strong style={{ color: 'var(--xp-blue)' }}>{matchCount}</strong> file
                {matchCount !== 1 ? 's' : ''} match in current directory
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button style={S.cancelBtn} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            style={{ ...S.saveBtn, ...(canSave ? {} : S.saveBtnDisabled) }}
            onClick={handleSave}
            disabled={!canSave}
            type="button"
          >
            {isEditing ? 'Save Changes' : 'Create Collection'}
          </button>
        </div>
      </div>
    </div>
  );
};

const CollectionEditorDialog = React.memo(CollectionEditorDialogInner);
export default CollectionEditorDialog;
