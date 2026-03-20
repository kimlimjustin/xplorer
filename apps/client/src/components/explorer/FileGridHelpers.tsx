import React from 'react';
import { FileEntry, FileTag } from '@/lib/tauri-api';

export const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'ico',
  'svg',
  'avif',
  'tiff',
  'tif',
]);

export const isImageFile = (file: FileEntry) : boolean => {
  if (file.is_dir) return false;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(ext);
}

// ─── Tag dots displayed under / beside a file name ───────────────────────────

export const TagDots = ({ tags }: { tags: FileTag[] }) => {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5 flex-wrap mt-0.5">
      {tags.map((tag, i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full flex-shrink-0 border border-black border-opacity-20"
          style={{ backgroundColor: tag.color }}
          title={tag.name}
        />
      ))}
    </div>
  );
}

// ─── Git status dot displayed next to a file name ────────────────────────────

export const GitStatusDot = ({ status }: { status: string | null }) => {
  if (!status) return null;

  const colorMap: Record<string, string> = {
    new: '#22c55e', // green
    untracked: '#22c55e', // green
    modified: '#f97316', // orange
    renamed: '#f97316', // orange
    deleted: '#ef4444', // red
    conflict: '#ef4444', // red
    ignored: '#9ca3af', // gray
  };

  const color = colorMap[status] || '#9ca3af';
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0 ml-1"
      style={{ backgroundColor: color }}
      title={`Git: ${label}`}
    />
  );
}
