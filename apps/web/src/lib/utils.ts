import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import React from 'react';
import {
  FolderClosed, FileText, FileCode, Globe, FileJson,
  Image as ImageIcon, Film, Music, BookOpen, Package,
  Settings, File as FileIcon, FileSpreadsheet, Presentation,
  type LucideIcon,
} from 'lucide-react';
import type { FileEntry, FolderSizeInfo } from '@/lib/tauri-api';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDownloadCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ── File icon mapping (mirrors client/src/lib/utils.ts) ─────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const icon = (Icon: LucideIcon, color: string): any =>
  React.createElement(Icon, { size: '1em', className: `inline-block ${color}` });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getFileIcon = (fileEntry: FileEntry): any => {
  if (fileEntry.is_dir) return icon(FolderClosed, 'text-xp-blue');
  const ext = fileEntry.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'txt': case 'md': case 'log': return icon(FileText, 'text-xp-text-muted');
    case 'ts': case 'tsx': case 'js': case 'jsx': case 'py': case 'rs': case 'go':
    case 'java': case 'c': case 'cpp': case 'h': case 'css': case 'scss': case 'html':
      return icon(FileCode, 'text-xp-cyan');
    case 'json': case 'yaml': case 'yml': case 'toml': return icon(FileJson, 'text-xp-green');
    case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'svg': case 'bmp':
      return icon(ImageIcon, 'text-xp-purple');
    case 'mp4': case 'mov': case 'avi': case 'mkv': case 'webm': return icon(Film, 'text-xp-pink');
    case 'mp3': case 'wav': case 'ogg': case 'flac': return icon(Music, 'text-xp-yellow');
    case 'pdf': case 'doc': case 'docx': return icon(BookOpen, 'text-xp-blue');
    case 'xls': case 'xlsx': case 'csv': return icon(FileSpreadsheet, 'text-xp-green');
    case 'ppt': case 'pptx': return icon(Presentation, 'text-xp-orange');
    case 'zip': case 'tar': case 'gz': case '7z': case 'rar': return icon(Package, 'text-xp-orange');
    case 'xml': case 'htm': return icon(Globe, 'text-xp-orange');
    case 'ini': case 'cfg': case 'conf': return icon(Settings, 'text-xp-text-muted');
    default: return icon(FileIcon, 'text-xp-text-muted');
  }
};

export function formatFolderSize(info: FolderSizeInfo | null | undefined, isCalculating?: boolean): string {
  if (isCalculating) return 'Calculating...';
  if (!info) return '';
  return formatFileSize(info.total_size);
}

/**
 * HIGH-W09: Validate and sanitize image URLs to prevent XSS via javascript: or data: URIs.
 * Only allows https:// URLs. Returns a placeholder for invalid or missing URLs.
 */
export function safeImageUrl(url: string | null | undefined): string {
  if (!url) return '/placeholder-icon.png';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') return url;
    return '/placeholder-icon.png';
  } catch {
    return '/placeholder-icon.png';
  }
}

// Stub for renderIcon used by copied Xplorer components
export const renderIcon = (
  name: string,
  size: number | string = '1em',
  className?: string,
): React.ReactNode => {
  const React = require('react');
  const { FileIcon } = require('lucide-react');
  return React.createElement(FileIcon, { size, className: className ?? 'inline-block' });
};

export const isValidIconName = (_name: string): boolean => false;
