import React, { useState, useEffect } from 'react';
import { PreviewProps } from '@/lib/preview-factory';
import { TauriAPI } from '@/lib/tauri-api';

type XLSXModule = typeof import('xlsx');

const SpreadsheetPreview = ({ file, onError, onLoad }: PreviewProps) => {
  const [sheets, setSheets] = useState<
    { name: string; data: (string | number | boolean | null)[][] }[]
  >([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSpreadsheet = async () => {
      try {
        setLoading(true);
        setError(null);

        // Read the file as binary data using TauriAPI
        const binaryData = await TauriAPI.readBinaryFile(file.path);

        // Dynamically import xlsx to avoid synchronous ~700KB bundle cost
        const XLSX: XLSXModule = await import('xlsx');

        // Parse the spreadsheet
        const workbook = XLSX.read(binaryData, { type: 'array' });

        // Convert sheets to data arrays
        const sheetsData = workbook.SheetNames.map((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false,
            defval: '',
          }) as (string | number | boolean | null)[][];

          return {
            name: sheetName,
            data: data.slice(0, 50), // Limit to first 50 rows for preview
          };
        });

        setSheets(sheetsData);
        onLoad?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load spreadsheet';
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setLoading(false);
      }
    };

    loadSpreadsheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.path]);

  const currentSheet = sheets[activeSheet];

  return (
    <div className="mt-4">
      <h4 className="text-xp-text-muted mb-2 text-xs font-medium">Spreadsheet Preview</h4>

      {loading && (
        <div className="bg-xp-surface border-xp-border text-xp-text-muted rounded border p-4 text-center">
          <div className="animate-pulse">
            <div className="bg-xp-bg mb-2 h-48 w-full rounded" />
            <p className="text-xs">Loading spreadsheet...</p>
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
          <p className="text-xs">Cannot preview spreadsheet</p>
          <p className="mt-1 text-xs opacity-70">{error}</p>
        </div>
      ) : null}
      {!error && sheets.length > 0 && (
        <>
          {/* Sheet tabs */}
          {sheets.length > 1 && (
            <div className="mb-2 flex space-x-1 overflow-x-auto">
              {sheets.map((sheet) => (
                <button
                  key={sheet.name}
                  onClick={() => setActiveSheet(sheets.indexOf(sheet))}
                  className={`whitespace-nowrap rounded px-2 py-1 text-xs ${
                    sheets.indexOf(sheet) === activeSheet
                      ? 'bg-xp-blue text-white'
                      : 'bg-xp-bg border-xp-border hover:bg-xp-surface-light border'
                  }`}
                >
                  {sheet.name}
                </button>
              ))}
            </div>
          )}

          {/* Table */}
          <div className="bg-xp-surface border-xp-border overflow-hidden rounded border">
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <tbody>
                  {currentSheet?.data.map((row, rowIndex) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <tr key={rowIndex} className={rowIndex === 0 ? 'bg-xp-bg font-medium' : ''}>
                      {row.map((cell, cellIndex) => (
                        <td
                          // eslint-disable-next-line react/no-array-index-key
                          key={cellIndex}
                          className="border-xp-border text-xp-text max-w-20 truncate border-b border-r px-2 py-1"
                          title={String(cell)}
                        >
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {currentSheet?.data.length >= 50 && (
            <p className="text-xp-text-muted mt-2 text-center text-xs">
              Showing first 50 rows. Double-click to open full file.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default SpreadsheetPreview;
