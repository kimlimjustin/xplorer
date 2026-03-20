import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { PreviewProps } from '@/lib/preview-factory';
import { TauriAPI } from '@/lib/tauri-api';

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
      <h4 className="text-xs font-medium mb-2 text-xp-text-muted">Spreadsheet Preview</h4>

      {loading && (
        <div className="bg-xp-surface border border-xp-border rounded p-4 text-center text-xp-text-muted">
          <div className="animate-pulse">
            <div className="w-full h-48 bg-xp-bg rounded mb-2"></div>
            <p className="text-xs">Loading spreadsheet...</p>
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
          <p className="text-xs">Cannot preview spreadsheet</p>
          <p className="text-xs mt-1 opacity-70">{error}</p>
        </div>
      ) : sheets.length > 0 ? (
        <>
          {/* Sheet tabs */}
          {sheets.length > 1 && (
            <div className="flex space-x-1 mb-2 overflow-x-auto">
              {sheets.map((sheet, index) => (
                <button
                  key={index}
                  onClick={() => setActiveSheet(index)}
                  className={`px-2 py-1 text-xs rounded whitespace-nowrap ${
                    index === activeSheet
                      ? 'bg-xp-blue text-white'
                      : 'bg-xp-bg border border-xp-border hover:bg-xp-surface-light'
                  }`}
                >
                  {sheet.name}
                </button>
              ))}
            </div>
          )}

          {/* Table */}
          <div className="bg-xp-surface border border-xp-border rounded overflow-hidden">
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <tbody>
                  {currentSheet?.data.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex === 0 ? 'bg-xp-bg font-medium' : ''}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-2 py-1 border-r border-b border-xp-border text-xp-text truncate max-w-20"
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
            <p className="text-xs text-xp-text-muted mt-2 text-center">
              Showing first 50 rows. Double-click to open full file.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

export default SpreadsheetPreview;
