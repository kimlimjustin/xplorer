import React, { useState, useEffect } from 'react';
import { PreviewProps } from '@/lib/preview-factory';
import { TauriAPI } from '@/lib/tauri-api';

const JsonPreview = ({ file, onError, onLoad }: PreviewProps) => {
  const [jsonData, setJsonData] = useState<unknown>(null);
  const [rawContent, setRawContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');

  useEffect(() => {
    const loadJson = async () => {
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
        setRawContent(fileContent);

        // Try to parse JSON
        try {
          const parsed = JSON.parse(fileContent);
          setJsonData(parsed);
        } catch {
          setError('Invalid JSON format');
          return;
        }

        onLoad?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load JSON file';
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setLoading(false);
      }
    };

    loadJson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.path, file.size]);

  const renderJsonValue = (value: unknown, depth = 0): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-xp-text-muted">null</span>;
    }

    if (typeof value === 'string') {
      const displayValue = value.length > 10000 ? value.slice(0, 10000) + '...[truncated]' : value;
      return <span className="text-xp-green">"{displayValue}"</span>;
    }

    if (typeof value === 'number') {
      return <span className="text-xp-blue">{value}</span>;
    }

    if (typeof value === 'boolean') {
      return <span className="text-xp-purple">{value.toString()}</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span>[]</span>;
      }

      return (
        <div>
          <span>[</span>
          {value.map((item: unknown, index: number) => (
            <div key={index} className="ml-4">
              {renderJsonValue(item, depth + 1)}
              {index < value.length - 1 && <span>,</span>}
            </div>
          ))}
          <span>]</span>
        </div>
      );
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 0) {
        return <span>{'{}'}</span>;
      }

      return (
        <div>
          <span>{'{'}</span>
          {keys.map((key, index) => (
            <div key={key} className="ml-4">
              <span className="text-xp-cyan">"{key}"</span>
              <span>: </span>
              {renderJsonValue(obj[key], depth + 1)}
              {index < keys.length - 1 && <span>,</span>}
            </div>
          ))}
          <span>{'}'}</span>
        </div>
      );
    }

    return <span>{String(value)}</span>;
  };

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-xs font-medium text-xp-text-muted">JSON Preview</h4>
        <div className="flex space-x-1">
          <button
            onClick={() => setViewMode('formatted')}
            className={`px-2 py-1 text-xs rounded ${
              viewMode === 'formatted'
                ? 'bg-xp-blue text-white'
                : 'bg-xp-bg border border-xp-border hover:bg-xp-surface-light'
            }`}
          >
            Formatted
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={`px-2 py-1 text-xs rounded ${
              viewMode === 'raw'
                ? 'bg-xp-blue text-white'
                : 'bg-xp-bg border border-xp-border hover:bg-xp-surface-light'
            }`}
          >
            Raw
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-xp-surface border border-xp-border rounded p-4 text-center text-xp-text-muted">
          <div className="animate-pulse">
            <div className="w-full h-48 bg-xp-bg rounded mb-2"></div>
            <p className="text-xs">Loading JSON...</p>
          </div>
        </div>
      )}

      {error ? (
        <div className="bg-xp-surface border border-xp-border rounded p-4 text-center text-xp-text-muted">
          <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-xs">Cannot preview JSON</p>
          <p className="text-xs mt-1 opacity-70">{error}</p>
        </div>
      ) : jsonData !== null ? (
        <div className="bg-xp-surface border border-xp-border rounded p-3 max-h-64 overflow-y-auto">
          {viewMode === 'formatted' ? (
            <div className="text-xs font-mono text-xp-text">{renderJsonValue(jsonData)}</div>
          ) : (
            <pre className="text-xs font-mono whitespace-pre-wrap text-xp-text break-words">
              {rawContent}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default JsonPreview;
