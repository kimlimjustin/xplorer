import React, { useState, useEffect } from 'react';
import mammoth from 'mammoth';
import DOMPurify from 'dompurify';
import { PreviewProps } from '@/lib/preview-factory';
import { TauriAPI } from '@/lib/tauri-api';

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
      <h4 className="text-xs font-medium mb-2 text-xp-text-muted">Document Preview</h4>

      {loading && (
        <div className="bg-xp-surface border border-xp-border rounded p-4 text-center text-xp-text-muted">
          <div className="animate-pulse">
            <div className="w-full h-48 bg-xp-bg rounded mb-2"></div>
            <p className="text-xs">Loading document...</p>
          </div>
        </div>
      )}

      {error ? (
        <div className="bg-xp-surface border border-xp-border rounded p-4 text-center text-xp-text-muted">
          <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-xs">Cannot preview document</p>
          <p className="text-xs mt-1 opacity-70">{error}</p>
        </div>
      ) : htmlContent ? (
        <div className="bg-xp-surface border border-xp-border rounded p-4 max-h-64 overflow-y-auto">
          <div
            className="text-xs prose prose-sm max-w-none text-xp-text"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            style={{
              fontFamily: 'inherit',
              color: 'inherit',
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export default DocumentPreview;
