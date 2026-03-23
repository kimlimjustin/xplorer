import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FOLDER_COLORS,
  getAllFolderColors,
  type FolderColor,
  type FolderColorDef,
} from '@/lib/folder-colors';
import type { FileEntry } from '@/lib/tauri-api';

// ── Types ────────────────────────────────────────────────────────────────────

interface FolderColorLegendProps {
  /** All files in the current directory listing. */
  files: FileEntry[];
  /** When a color dot is clicked, emit the colorId (or null to clear filter). */
  onFilterByColor?: (colorId: string | null) => void;
  /** Currently active color filter, if any. */
  activeColorFilter?: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

const FolderColorLegend = React.memo(
  ({ files, onFilterByColor, activeColorFilter }: FolderColorLegendProps) => {
    // Re-read folder colors whenever they change
    const [allColors, setAllColors] = useState<FolderColor[]>(() => getAllFolderColors());

    useEffect(() => {
      const handler = () => setAllColors(getAllFolderColors());
      window.addEventListener('folder-colors-changed', handler);
      return () => window.removeEventListener('folder-colors-changed', handler);
    }, []);

    // Build a set of folder paths in the current directory for quick lookup
    const folderPaths = useMemo(() => {
      const set = new Set<string>();
      for (const f of files) {
        if (f.is_dir) set.add(f.path);
      }
      return set;
    }, [files]);

    // Count how many folders in the current directory have each color
    const colorCounts = useMemo(() => {
      const counts = new Map<string, number>();
      for (const entry of allColors) {
        if (folderPaths.has(entry.path)) {
          counts.set(entry.colorId, (counts.get(entry.colorId) || 0) + 1);
        }
      }
      return counts;
    }, [allColors, folderPaths]);

    const handleClick = useCallback(
      (colorId: string) => {
        if (!onFilterByColor) return;
        // Toggle: if already active, clear; otherwise set
        if (activeColorFilter === colorId) {
          onFilterByColor(null);
        } else {
          onFilterByColor(colorId);
        }
      },
      [onFilterByColor, activeColorFilter],
    );

    // Only render when at least one folder in the current directory has a color
    if (colorCounts.size === 0) return null;

    // Build ordered entries (only colors that have at least 1 folder)
    const entries: { def: FolderColorDef; count: number }[] = [];
    for (const c of FOLDER_COLORS) {
      const count = colorCounts.get(c.id);
      if (count && count > 0) {
        entries.push({ def: c, count });
      }
    }

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 4px',
        }}
        aria-label="Folder color legend"
      >
        {entries.map(({ def, count }) => {
          const isActive = activeColorFilter === def.id;
          return (
            <button
              key={def.id}
              onClick={() => handleClick(def.id)}
              title={`${def.label}: ${count} folder${count !== 1 ? 's' : ''}${isActive ? ' (click to clear filter)' : ''}`}
              aria-label={`${def.label}: ${count} folder${count !== 1 ? 's' : ''}`}
              aria-pressed={isActive}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '1px 4px',
                borderRadius: 4,
                border: 'none',
                background: isActive ? `${def.hex}25` : 'transparent',
                cursor: onFilterByColor ? 'pointer' : 'default',
                lineHeight: 1,
                fontSize: 11,
                color: 'var(--xp-text-muted)',
                transition: 'background 0.15s ease',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: def.hex,
                  flexShrink: 0,
                  boxShadow: isActive ? `0 0 0 2px ${def.hex}60` : undefined,
                }}
                aria-hidden="true"
              />
              <span>{count}</span>
            </button>
          );
        })}
      </div>
    );
  },
);
FolderColorLegend.displayName = 'FolderColorLegend';

export default FolderColorLegend;
