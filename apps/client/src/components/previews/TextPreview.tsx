import React, { useState, useEffect } from 'react';
import { PreviewProps } from '@/lib/preview-factory';
import { TauriAPI } from '@/lib/tauri-api';

const TextPreview = ({ file, onError, onLoad }: PreviewProps) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadText = async () => {
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

        // Limit content for preview (first 5000 characters)
        const truncatedContent =
          fileContent.length > 5000
            ? `${fileContent.slice(0, 5000)}\n... (file truncated for preview)`
            : fileContent;

        setContent(truncatedContent);
        onLoad?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load text file';
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setLoading(false);
      }
    };

    loadText();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.path, file.size]);

  return (
    <div className="mt-4">
      <h4 className="text-xp-text-muted mb-2 text-xs font-medium">Text Preview</h4>

      {loading && (
        <div className="bg-xp-surface border-xp-border text-xp-text-muted rounded border p-4 text-center">
          <div className="animate-pulse">
            <div className="bg-xp-bg mb-2 h-32 w-full rounded" />
            <p className="text-xs">Loading text...</p>
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
          <p className="text-xs">Cannot preview text</p>
          <p className="mt-1 text-xs opacity-70">{error}</p>
        </div>
      ) : null}
      {!error && content && (
        <div className="bg-xp-surface border-xp-border max-h-64 overflow-y-auto rounded border p-3">
          <pre className="text-xp-text whitespace-pre-wrap break-words font-mono text-xs">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
};

export default TextPreview;
