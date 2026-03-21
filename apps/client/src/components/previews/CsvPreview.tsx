import React, { useState, useEffect } from 'react';
import * as Papa from 'papaparse';
import { PreviewProps } from '@/lib/preview-factory';
import { TauriAPI } from '@/lib/tauri-api';

const CsvPreview = ({ file, onError, onLoad }: PreviewProps) => {
  const [data, setData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ delimiter: string; rowCount: number } | null>(null);

  useEffect(() => {
    const loadCsv = async () => {
      try {
        setLoading(true);

        // Don't load very large files
        if (file.size > 10 * 1024 * 1024) {
          // 10MB limit
          setError('File is too large for preview');
          return;
        }

        // Read file content
        const fileContent = await TauriAPI.readTextFile(file.path);

        // Parse CSV
        const parseResult = Papa.parse(fileContent, {
          header: false,
          skipEmptyLines: true,
          preview: 100, // Limit to first 100 rows
        });

        if (parseResult.errors.length > 0) {
          console.warn('CSV parsing warnings:', parseResult.errors);
        }

        const rows = parseResult.data as string[][];

        if (rows.length > 0) {
          setHeaders(rows[0]);
          setData(rows.slice(1));
          setMeta({
            delimiter: parseResult.meta.delimiter,
            rowCount: parseResult.data.length,
          });
        }

        onLoad?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load CSV file';
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setLoading(false);
      }
    };

    loadCsv();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.path, file.size]);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xp-text-muted text-xs font-medium">CSV Preview</h4>
        {meta && (
          <span className="text-xp-text-muted text-xs">
            {meta.rowCount} rows • delimiter: "{meta.delimiter}"
          </span>
        )}
      </div>

      {loading && (
        <div className="bg-xp-surface border-xp-border text-xp-text-muted rounded border p-4 text-center">
          <div className="animate-pulse">
            <div className="bg-xp-bg mb-2 h-48 w-full rounded" />
            <p className="text-xs">Loading CSV...</p>
          </div>
        </div>
      )}

      {error ? (
        <div className="bg-xp-surface border-xp-border text-xp-text-muted rounded border p-4 text-center">
          <svg className="mx-auto mb-2 h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-xs">Cannot preview CSV</p>
          <p className="mt-1 text-xs opacity-70">{error}</p>
        </div>
      ) : null}
      {!error && data.length > 0 && (
        <>
          <div className="bg-xp-surface border-xp-border overflow-hidden rounded border">
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-xp-bg sticky top-0">
                  <tr>
                    {headers.map((header, index) => (
                      <th
                        // eslint-disable-next-line react/no-array-index-key
                        key={index}
                        className="border-xp-border text-xp-text truncate border-b border-r px-2 py-1 text-left font-medium"
                        title={header}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, rowIndex) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <tr key={rowIndex} className="hover:bg-xp-bg">
                      {row.map((cell, cellIndex) => (
                        <td
                          // eslint-disable-next-line react/no-array-index-key
                          key={cellIndex}
                          className="border-xp-border text-xp-text max-w-32 truncate border-b border-r px-2 py-1"
                          title={cell}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data.length >= 99 && (
            <p className="text-xp-text-muted mt-2 text-center text-xs">
              Showing first 100 rows. Double-click to open full file.
            </p>
          )}
        </>
      )}
      {!error && data.length === 0 && (
        <div className="bg-xp-surface border-xp-border text-xp-text-muted rounded border p-4 text-center">
          <p className="text-xs">No data found in CSV file</p>
        </div>
      )}
    </div>
  );
};

export default CsvPreview;
