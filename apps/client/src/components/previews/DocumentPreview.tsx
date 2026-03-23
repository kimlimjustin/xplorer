import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { PreviewProps } from '@/lib/preview-factory';
import { TauriAPI } from '@/lib/tauri-api';

type MammothModule = typeof import('mammoth');

const DocumentPreview = ({ file, onError, onLoad }: PreviewProps) => {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDocument = async () => {
      try {
        setLoading(true);
        setError(null); // Reset error state

        // Read the file as binary data using Tauri's fs plugin
        const uint8Array = await TauriAPI.readBinaryFile(file.path);
        const arrayBuffer = uint8Array.buffer.slice(0) as ArrayBuffer;

        // Dynamically import mammoth to avoid synchronous ~200KB bundle cost
        const mammoth: MammothModule = await import('mammoth');

        // Convert DOCX to HTML using mammoth
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setHtmlContent(
          DOMPurify.sanitize(result.value, {
            FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
            ALLOW_DATA_ATTR: false,
          }),
        );

        if (result.messages.length > 0) {
          console.warn('Document conversion warnings:', result.messages);
        }

        onLoad?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load document';
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setLoading(false);
      }
    };

    if (file.name.toLowerCase().endsWith('.docx')) {
      loadDocument();
    } else {
      setError('Unsupported document format');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.path, file.name]);

  return (
    <div className="mt-4">
      <h4 className="text-xp-text-muted mb-2 text-xs font-medium">Document Preview</h4>

      {loading && (
        <div className="bg-xp-surface border-xp-border text-xp-text-muted rounded border p-4 text-center">
          <div className="animate-pulse">
            <div className="bg-xp-bg mb-2 h-48 w-full rounded" />
            <p className="text-xs">Loading document...</p>
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
          <p className="text-xs">Cannot preview document</p>
          <p className="mt-1 text-xs opacity-70">{error}</p>
        </div>
      ) : null}
      {!error && htmlContent && (
        <div className="bg-xp-surface border-xp-border max-h-64 overflow-y-auto rounded border p-4">
          <div
            className="text-xp-text prose prose-sm max-w-none text-xs"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            style={{
              fontFamily: 'inherit',
              color: 'inherit',
            }}
          />
        </div>
      )}
    </div>
  );
};

export default DocumentPreview;
