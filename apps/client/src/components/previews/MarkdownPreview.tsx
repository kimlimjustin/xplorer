import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { PreviewProps } from '@/lib/preview-factory';
import { TauriAPI } from '@/lib/tauri-api';

const MarkdownPreview = ({ file, onError, onLoad }: PreviewProps) => {
  const [content, setContent] = useState<string>('');
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');

  useEffect(() => {
    const loadMarkdown = async () => {
      try {
        setLoading(true);

        // Don't load very large files
        if (file.size > 5 * 1024 * 1024) {
          // 5MB limit
          setError('File is too large for preview');
          return;
        }

        // Read file content
        const fileContent = await TauriAPI.readTextFile(file.path);
        setContent(fileContent);

        // Simple markdown to HTML conversion (sanitized to prevent XSS)
        const htmlConverted = DOMPurify.sanitize(convertMarkdownToHtml(fileContent), {
          FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
          FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
          ALLOW_DATA_ATTR: false,
        });
        setHtmlContent(htmlConverted);

        onLoad?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load markdown file';
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setLoading(false);
      }
    };

    loadMarkdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.path, file.size]);

  // Simple markdown to HTML converter
  const convertMarkdownToHtml = (markdown: string): string => {
    let html = markdown;

    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3 class="text-sm font-semibold mb-2 mt-4">$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2 class="text-base font-semibold mb-2 mt-4">$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1 class="text-lg font-bold mb-3 mt-4">$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

    // Code blocks
    html = html.replace(
      /```([\s\S]*?)```/g,
      '<pre class="bg-xp-bg border border-xp-border rounded p-2 my-2 text-xs font-mono overflow-x-auto"><code>$1</code></pre>',
    );

    // Inline code
    html = html.replace(
      /`(.*?)`/g,
      '<code class="bg-xp-bg px-1 rounded text-xs font-mono">$1</code>',
    );

    // Links
    html = html.replace(
      /\[([^\]]*)\]\(([^)]*)\)/g,
      '<a href="$2" class="text-xp-blue hover:underline" target="_blank">$1</a>',
    );

    // Lists
    html = html.replace(/^\* (.*$)/gm, '<li class="ml-4">• $1</li>');
    html = html.replace(/^- (.*$)/gm, '<li class="ml-4">• $1</li>');
    html = html.replace(/^\d+\. (.*$)/gm, '<li class="ml-4">$1</li>');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p class="mb-2">');
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph
    html = `<p class="mb-2">${html}</p>`;

    return html;
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-shrink-0 items-center justify-between px-3 py-2">
        <h4 className="text-xp-text-muted text-xs font-medium">Markdown Preview</h4>
        <div className="flex space-x-1">
          <button
            onClick={() => setViewMode('rendered')}
            className={`rounded px-2 py-1 text-xs ${
              viewMode === 'rendered'
                ? 'bg-xp-blue text-white'
                : 'bg-xp-bg border-xp-border hover:bg-xp-surface-light border'
            }`}
          >
            Rendered
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={`rounded px-2 py-1 text-xs ${
              viewMode === 'raw'
                ? 'bg-xp-blue text-white'
                : 'bg-xp-bg border-xp-border hover:bg-xp-surface-light border'
            }`}
          >
            Raw
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {loading && (
          <div className="bg-xp-surface border-xp-border text-xp-text-muted rounded border p-4 text-center">
            <div className="animate-pulse">
              <div className="bg-xp-bg mb-2 h-48 w-full rounded" />
              <p className="text-xs">Loading markdown...</p>
            </div>
          </div>
        )}

        {error ? (
          <div className="bg-xp-surface border-xp-border text-xp-text-muted rounded border p-4 text-center">
            <svg className="mx-auto mb-2 h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-xs">Cannot preview markdown</p>
            <p className="mt-1 text-xs opacity-70">{error}</p>
          </div>
        ) : null}
        {!error && content && (
          <div className="bg-xp-surface border-xp-border rounded border p-3">
            {viewMode === 'rendered' ? (
              <div
                className="text-xp-text prose-sm text-xs"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            ) : (
              <pre className="text-xp-text whitespace-pre-wrap break-words font-mono text-xs">
                {content}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkdownPreview;
