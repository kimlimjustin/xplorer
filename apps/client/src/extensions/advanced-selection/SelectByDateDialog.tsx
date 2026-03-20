import React, { useState, useMemo } from 'react';
import { FileEntry } from '@/lib/tauri-api';
import { DATE_RANGE_PRESETS } from './types';
import { getFileDateRange } from './selection-utils';

interface SelectByDateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (dateFrom: Date, dateTo: Date) => void;
  files: FileEntry[];
}

export const SelectByDateDialog = ({ isOpen, onClose, onSelect, files }: SelectByDateDialogProps) => {
  const dateRange = useMemo(() => getFileDateRange(files), [files]);

  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const applyPreset = (preset: (typeof DATE_RANGE_PRESETS)[0]) => {
    const range = preset.getRange();
    setDateFrom(formatDateForInput(range.from));
    setDateTo(formatDateForInput(range.to));
    setSelectedPreset(preset.label);
  };

  const handleSelect = () => {
    if (dateFrom && dateTo) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      onSelect(from, to);
    }
    onClose();
  };

  const clearDates = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedPreset(null);
  };

  // Count files in selected range
  const matchCount = useMemo(() => {
    if (!dateFrom || !dateTo) return 0;
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);

    return files.filter((file) => {
      const fileDate = new Date(file.modified * 1000);
      return fileDate >= from && fileDate <= to;
    }).length;
  }, [files, dateFrom, dateTo]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-xp-surface border border-xp-border rounded-lg shadow-xl w-[450px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-xp-border">
          <h2 className="text-lg font-semibold text-xp-text">Select by Date</h2>
          <button onClick={onClose} className="p-1 hover:bg-xp-surface-light rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* File Date Info */}
          <div className="p-3 bg-xp-bg rounded-md text-sm">
            <div className="flex justify-between text-xp-text-muted">
              <span>Oldest file:</span>
              <span>{dateRange.oldest.toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-xp-text-muted">
              <span>Newest file:</span>
              <span>{dateRange.newest.toLocaleDateString()}</span>
            </div>
          </div>

          {/* Presets */}
          <div>
            <h3 className="text-sm font-medium text-xp-text-muted mb-2">Quick Select</h3>
            <div className="grid grid-cols-2 gap-2">
              {DATE_RANGE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                    selectedPreset === preset.label
                      ? 'bg-xp-primary text-white'
                      : 'bg-xp-bg hover:bg-xp-surface-light border border-xp-border'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          <div>
            <h3 className="text-sm font-medium text-xp-text-muted mb-2">Custom Range</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-xp-text-muted mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setSelectedPreset(null);
                  }}
                  max={dateTo || undefined}
                  className="w-full px-3 py-2 bg-xp-bg border border-xp-border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-xp-text-muted mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setSelectedPreset(null);
                  }}
                  min={dateFrom || undefined}
                  className="w-full px-3 py-2 bg-xp-bg border border-xp-border rounded-md text-sm"
                />
              </div>
            </div>
          </div>

          {/* Preview Count */}
          {dateFrom && dateTo && (
            <div className="flex items-center justify-between p-3 bg-xp-primary/10 border border-xp-primary/30 rounded-md">
              <span className="text-sm text-xp-text">Files matching:</span>
              <span className="text-lg font-semibold text-xp-primary">{matchCount}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-xp-border">
          <button onClick={clearDates} className="text-sm text-xp-text-muted hover:text-xp-text">
            Clear
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-xp-text-muted hover:text-xp-text"
            >
              Cancel
            </button>
            <button
              onClick={handleSelect}
              disabled={!dateFrom || !dateTo || matchCount === 0}
              className="px-4 py-2 bg-xp-primary text-white rounded-md text-sm disabled:opacity-50"
            >
              Select {matchCount} Files
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
