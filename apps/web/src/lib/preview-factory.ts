// Mock PreviewFactory for web landing page demos

import React from 'react';
import type { FileEntry } from '@/lib/tauri-api';

export type PreviewType =
  | 'image'
  | 'pdf'
  | 'document'
  | 'spreadsheet'
  | 'text'
  | 'code'
  | 'csv'
  | 'json'
  | 'markdown'
  | 'video'
  | 'audio'
  | 'archive'
  | 'folder'
  | 'unknown';

export interface PreviewCapability {
  type: PreviewType;
  extensions: string[];
  mimeTypes?: string[];
  maxSize?: number;
  priority: number;
  canPreview: (file: FileEntry) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPreviewComponent: () => Promise<any>;
}

export interface PreviewProps {
  file: FileEntry;
  onError?: (error: Error) => void;
  onLoad?: () => void;
}

export interface PreviewFactoryConfig {
  enabledTypes: PreviewType[];
  maxFileSize: number;
  enableFallback: boolean;
  customPreviews?: Map<string, PreviewCapability>;
}

const CODE_EXTENSIONS = new Set([
  'js',
  'ts',
  'jsx',
  'tsx',
  'py',
  'java',
  'cpp',
  'c',
  'cs',
  'php',
  'rb',
  'go',
  'rs',
  'html',
  'css',
  'scss',
  'less',
  'vue',
  'svelte',
]);

// Inline code preview component for the demo
const DEMO_CODE_LINES = [
  {
    tokens: [
      { text: 'import', c: '#a78bfa' },
      { text: ' React ', c: 'rgba(255,255,255,0.92)' },
      { text: 'from', c: '#a78bfa' },
      { text: " 'react'", c: '#34d399' },
      { text: ';', c: 'rgba(255,255,255,0.40)' },
    ],
  },
  {
    tokens: [
      { text: 'import', c: '#a78bfa' },
      { text: ' { useState } ', c: 'rgba(255,255,255,0.92)' },
      { text: 'from', c: '#a78bfa' },
      { text: " 'react'", c: '#34d399' },
      { text: ';', c: 'rgba(255,255,255,0.40)' },
    ],
  },
  { tokens: [] },
  {
    tokens: [
      { text: 'export', c: '#a78bfa' },
      { text: ' function ', c: '#6366f1' },
      { text: 'App', c: '#fbbf24' },
      { text: '() {', c: 'rgba(255,255,255,0.92)' },
    ],
  },
  {
    tokens: [
      { text: '  const ', c: '#a78bfa' },
      { text: '[count, setCount]', c: 'rgba(255,255,255,0.92)' },
      { text: ' = ', c: '#22d3ee' },
      { text: 'useState', c: '#6366f1' },
      { text: '(', c: 'rgba(255,255,255,0.92)' },
      { text: '0', c: '#fb923c' },
      { text: ');', c: 'rgba(255,255,255,0.40)' },
    ],
  },
  { tokens: [] },
  {
    tokens: [
      { text: '  return', c: '#a78bfa' },
      { text: ' (', c: 'rgba(255,255,255,0.92)' },
    ],
  },
  {
    tokens: [
      { text: '    <', c: 'rgba(255,255,255,0.40)' },
      { text: 'div', c: '#f87171' },
      { text: ' className', c: '#22d3ee' },
      { text: '=', c: 'rgba(255,255,255,0.40)' },
      { text: '"app"', c: '#34d399' },
      { text: '>', c: 'rgba(255,255,255,0.40)' },
    ],
  },
  {
    tokens: [
      { text: '      <', c: 'rgba(255,255,255,0.40)' },
      { text: 'h1', c: '#f87171' },
      { text: '>', c: 'rgba(255,255,255,0.40)' },
      { text: 'Count: {count}', c: 'rgba(255,255,255,0.92)' },
      { text: '</', c: 'rgba(255,255,255,0.40)' },
      { text: 'h1', c: '#f87171' },
      { text: '>', c: 'rgba(255,255,255,0.40)' },
    ],
  },
  {
    tokens: [
      { text: '      <', c: 'rgba(255,255,255,0.40)' },
      { text: 'button', c: '#f87171' },
      { text: ' onClick', c: '#22d3ee' },
      { text: '=', c: 'rgba(255,255,255,0.40)' },
      { text: '{() => setCount(c + 1)}', c: 'rgba(255,255,255,0.92)' },
      { text: '>', c: 'rgba(255,255,255,0.40)' },
    ],
  },
  { tokens: [{ text: '        Increment', c: 'rgba(255,255,255,0.92)' }] },
  {
    tokens: [
      { text: '      </', c: 'rgba(255,255,255,0.40)' },
      { text: 'button', c: '#f87171' },
      { text: '>', c: 'rgba(255,255,255,0.40)' },
    ],
  },
  {
    tokens: [
      { text: '    </', c: 'rgba(255,255,255,0.40)' },
      { text: 'div', c: '#f87171' },
      { text: '>', c: 'rgba(255,255,255,0.40)' },
    ],
  },
  { tokens: [{ text: '  );', c: 'rgba(255,255,255,0.92)' }] },
  { tokens: [{ text: '}', c: 'rgba(255,255,255,0.92)' }] },
];

function DemoCodePreview({ file, onLoad }: PreviewProps) {
  React.useEffect(() => {
    onLoad?.();
  }, []);
  return React.createElement(
    'div',
    { className: 'font-mono text-xs leading-[1.6] h-full overflow-auto bg-xp-bg' },
    DEMO_CODE_LINES.map((line, i) =>
      React.createElement(
        'div',
        { key: i, className: `flex ${i === 4 ? 'bg-[#6366f1]/10' : ''}` },
        React.createElement(
          'span',
          {
            className: 'w-8 text-right pr-2 select-none text-xp-text-muted shrink-0 bg-xp-surface',
          },
          i + 1,
        ),
        React.createElement(
          'span',
          { className: 'whitespace-pre pl-1' },
          line.tokens.length === 0
            ? '\u00A0'
            : line.tokens.map((t, j) =>
                React.createElement('span', { key: j, style: { color: t.c } }, t.text),
              ),
        ),
      ),
    ),
  );
}

export class PreviewFactory {
  constructor(_config?: Partial<PreviewFactoryConfig>) {}

  public getFileType(file: FileEntry): PreviewType {
    if (file.is_dir) return 'folder';
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['md', 'markdown'].includes(ext)) return 'markdown';
    if (['json', 'jsonl'].includes(ext)) return 'json';
    if (['csv', 'tsv'].includes(ext)) return 'csv';
    if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return 'audio';
    if (['zip', 'tar', 'gz', '7z', 'rar'].includes(ext)) return 'archive';
    if (CODE_EXTENSIONS.has(ext)) return 'code';
    if (['txt', 'log', 'ini', 'cfg'].includes(ext)) return 'text';
    return 'unknown';
  }

  public canPreview(file: FileEntry): boolean {
    if (file.is_dir) return false;
    return this.getFileType(file) !== 'unknown';
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async getPreviewComponent(file: FileEntry): Promise<any> {
    const type = this.getFileType(file);
    if (type === 'code' || type === 'text') return DemoCodePreview;
    return null;
  }

  public registerPreview(_capability: PreviewCapability): void {}
  public unregisterPreview(_type: PreviewType): void {}
}

export const defaultPreviewFactory = new PreviewFactory();
