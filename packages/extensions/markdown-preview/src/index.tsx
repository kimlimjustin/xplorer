/**
 * Markdown Preview Extension
 *
 * Demonstrates: Preview.register() with canPreview() filtering,
 * file text reading, React component rendering, inline markdown-to-HTML.
 *
 * Usage: Select a .md file and it renders in the preview panel.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Preview, type XplorerAPI } from '@xplorer/extension-sdk';

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
}

// ── Markdown Parser ─────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseMarkdown(md: string): string {
  let html = md;

  // Fenced code blocks (```lang ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    const langLabel = lang ? `<span style="position:absolute;top:4px;right:8px;font-size:10px;opacity:0.5">${escapeHtml(lang)}</span>` : '';
    return `<pre style="position:relative;background:var(--xp-surface-light,#1e1e2e);border:1px solid var(--xp-border,#333);border-radius:6px;padding:12px;overflow-x:auto;font-family:monospace;font-size:13px;line-height:1.5">${langLabel}<code>${escapeHtml(code)}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--xp-surface-light,#1e1e2e);padding:2px 6px;border-radius:3px;font-family:monospace;font-size:0.9em">$1</code>');

  // Headings (# to ######)
  html = html.replace(/^######\s+(.+)$/gm, '<h6 style="font-size:0.85em;font-weight:600;margin:16px 0 8px;color:var(--xp-text-muted,#888)">$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5 style="font-size:0.9em;font-weight:600;margin:16px 0 8px;color:var(--xp-text-secondary,#aaa)">$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4 style="font-size:1em;font-weight:600;margin:20px 0 8px">$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3 style="font-size:1.15em;font-weight:600;margin:20px 0 8px">$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2 style="font-size:1.35em;font-weight:600;margin:24px 0 8px;border-bottom:1px solid var(--xp-border,#333);padding-bottom:4px">$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1 style="font-size:1.6em;font-weight:700;margin:24px 0 12px;border-bottom:2px solid var(--xp-border,#333);padding-bottom:6px">$1</h1>');

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote style="border-left:3px solid var(--xp-blue,#7aa2f7);padding:4px 12px;margin:8px 0;color:var(--xp-text-secondary,#aaa);font-style:italic">$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid var(--xp-border,#333);margin:16px 0">');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Links and images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:4px;margin:8px 0">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:var(--xp-blue,#7aa2f7);text-decoration:none" target="_blank">$1</a>');

  // Unordered lists (simple single-level)
  html = html.replace(/^[\*\-]\s+(.+)$/gm, '<li style="margin:2px 0">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, (match) => `<ul style="padding-left:20px;margin:8px 0">${match}</ul>`);

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li style="margin:2px 0">$1</li>');

  // Task lists
  html = html.replace(/<li([^>]*)>\s*\[x\]\s*/gi, '<li$1>☑ ');
  html = html.replace(/<li([^>]*)>\s*\[ \]\s*/gi, '<li$1>☐ ');

  // Paragraphs (wrap remaining text lines)
  html = html.replace(/^(?!<[a-z])((?!^\s*$).+)$/gm, '<p style="margin:8px 0;line-height:1.6">$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');

  return html;
}

// ── HTML Sanitizer ───────────────────────────────────────────────────────────

/**
 * Sanitize HTML output to prevent XSS attacks.
 *
 * - Strips <script>, <iframe>, <object>, <embed> tags and their contents
 * - Removes event handler attributes (onclick, onerror, onload, etc.)
 * - Converts javascript: URLs to safe "#" hrefs
 */
const sanitizeHtml = (html: string): string => {
  let sanitized = html;

  // Strip <script>...</script> tags and contents
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Strip self-closing / unclosed <script> tags
  sanitized = sanitized.replace(/<script\b[^>]*\/?>/gi, '');

  // Strip <iframe> tags and contents
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^>]*\/?>/gi, '');

  // Strip <object> tags and contents
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<object\b[^>]*\/?>/gi, '');

  // Strip <embed> tags
  sanitized = sanitized.replace(/<embed\b[^>]*\/?>/gi, '');

  // Remove event handler attributes (on*)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Convert javascript: URLs to "#"
  sanitized = sanitized.replace(/\bhref\s*=\s*"javascript:[^"]*"/gi, 'href="#"');
  sanitized = sanitized.replace(/\bhref\s*=\s*'javascript:[^']*'/gi, "href='#'");
  sanitized = sanitized.replace(/\bsrc\s*=\s*"javascript:[^"]*"/gi, 'src="#"');
  sanitized = sanitized.replace(/\bsrc\s*=\s*'javascript:[^']*'/gi, "src='#'");

  return sanitized;
};

// ── Preview Component ───────────────────────────────────────────────────────

function MarkdownPreviewPanel({ filePath }: { filePath: string }) {
  const [content, setContent] = useState<string>('');
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.files.readText(filePath)
      .then((text) => {
        if (cancelled) return;
        setContent(text);
        setHtml(sanitizeHtml(parseMarkdown(text)));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(String(err));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [filePath]);

  const filename = filePath.split(/[/\\]/).pop() || 'Unknown';
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const lineCount = content.split('\n').length;

  if (loading) {
    return (
      <div style={{ padding: 16, color: 'var(--xp-text-muted, #888)', fontSize: 13 }}>
        Loading preview...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, color: 'var(--xp-red, #f7768e)', fontSize: 13 }}>
        {`Error: ${error}`}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--xp-border, #333)',
          fontSize: 11,
          color: 'var(--xp-text-muted, #888)',
          display: 'flex',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span>{filename}</span>
        <span>{`${wordCount} words · ${lineCount} lines`}</span>
      </div>
      {/* Content */}
      <div
        style={{ padding: '12px 16px', fontSize: 14, lineHeight: 1.6, color: 'var(--xp-text, #c0caf5)' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ── Extension Registration ──────────────────────────────────────────────────

let api: XplorerAPI;

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdx', 'mkd', 'mkdn']);

function isMarkdownFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return MARKDOWN_EXTENSIONS.has(ext);
}

Preview.register({
  id: 'xplorer-markdown-preview',
  title: 'Markdown Preview',
  description: 'Preview Markdown files with formatted rendering',
  icon: 'file-text',
  permissions: ['file:read'],

  canPreview: (file) => !file.is_dir && isMarkdownFile(file.path),
  priority: 10,

  onActivate: (injectedApi) => { api = injectedApi; },

  render: (props) => {
    const selectedFiles = (props.selectedFiles || []) as FileEntry[];
    const mdFile = selectedFiles.find(f => isMarkdownFile(f.path));

    if (!mdFile) {
      return (
        <div style={{ padding: 16, color: 'var(--xp-text-muted, #888)', fontSize: 13, textAlign: 'center' as const }}>
          <div style={{ marginBottom: 8, fontSize: 24 }}>📝</div>
          Select a Markdown file to preview
        </div>
      );
    }

    return <MarkdownPreviewPanel filePath={mdFile.path} />;
  },
});
