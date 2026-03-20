import React, { useState, useMemo } from 'react';
import { FileEntry } from '@/lib/tauri-api';
import { SIZE_RANGE_PRESETS } from './types';
import { getFileSizeStats } from './selection-utils';

interface SelectBySizeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (minSize: number, maxSize: number) => void;
  files: FileEntry[];
}

type SizeUnit = 'B' | 'KB' | 'MB' | 'GB';

const UNIT_MULTIPLIERS: Record<SizeUnit, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
};

const formatSize = (bytes: number) : string => {
  if (bytes === 0) return '0 B';
  if (bytes === Infinity) return 'Unlimited';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export const SelectBySizeDialog = ({ isOpen, onClose, onSelect, files }: SelectBySizeDialogProps) => {
  const sizeStats = useMemo(() => getFileSizeStats(files), [files]);

  const [minValue, setMinValue] = useState<string>('');
  const [minUnit, setMinUnit] = useState<SizeUnit>('KB');
  const [maxValue, setMaxValue] = useState<string>('');
  const [maxUnit, setMaxUnit] = useState<SizeUnit>('MB');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [includeUnlimited, setIncludeUnlimited] = useState(false);

  const getMinBytes = (): number => {
    if (!minValue) return 0;
    return parseFloat(minValue) * UNIT_MULTIPLIERS[minUnit];
  };

  const getMaxBytes = (): number => {
    if (includeUnlimited || !maxValue) return Infinity;
    return parseFloat(maxValue) * UNIT_MULTIPLIERS[maxUnit];
  };

  const applyPreset = (preset: (typeof SIZE_RANGE_PRESETS)[0]) => {
    // Convert to appropriate units
    if (preset.min < 1024) {
      setMinValue(preset.min.toString());
      setMinUnit('B');
    } else if (preset.min < 1024 * 1024) {
      setMinValue((preset.min / 1024).toString());
      setMinUnit('KB');
    } else {
      setMinValue((preset.min / (1024 * 1024)).toString());
      setMinUnit('MB');
    }

    if (preset.max === Infinity) {
      setMaxValue('');
      setIncludeUnlimited(true);
    } else if (preset.max < 1024 * 1024) {
      setMaxValue((preset.max / 1024).toString());
      setMaxUnit('KB');
      setIncludeUnlimited(false);
    } else if (preset.max < 1024 * 1024 * 1024) {
      setMaxValue((preset.max / (1024 * 1024)).toString());
      setMaxUnit('MB');
      setIncludeUnlimited(false);
    } else {
      setMaxValue((preset.max / (1024 * 1024 * 1024)).toString());
      setMaxUnit('GB');
      setIncludeUnlimited(false);
    }

    setSelectedPreset(preset.label);
  };

  const handleSelect = () => {
    onSelect(getMinBytes(), getMaxBytes());
    onClose();
  };

  const clearValues = () => {
    setMinValue('');
    setMaxValue('');
    setSelectedPreset(null);
    setIncludeUnlimited(false);
  };

  // Count files in selected range
  const matchCount = useMemo(() => {
    const minBytes = !minValue ? 0 : parseFloat(minValue) * UNIT_MULTIPLIERS[minUnit];
    const maxBytes = includeUnlimited || !maxValue ? Infinity : parseFloat(maxValue) * UNIT_MULTIPLIERS[maxUnit];

    return files.filter((file) => {
      if (file.is_dir) return false;
      return file.size >= minBytes && (maxBytes === Infinity || file.size <= maxBytes);
    }).length;
  }, [files, minValue, minUnit, maxValue, maxUnit, includeUnlimited]);

  const totalFileCount = useMemo(() => files.filter((f) => !f.is_dir).length, [files]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-xp-surface border border-xp-border rounded-lg shadow-xl w-[450px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-xp-border">
          <h2 className="text-lg font-semibold text-xp-text">Select by Size</h2>
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
          {/* File Size Info */}
          <div className="p-3 bg-xp-bg rounded-md text-sm space-y-1">
            <div className="flex justify-between text-xp-text-muted">
              <span>Total files:</span>
              <span>{totalFileCount}</span>
            </div>
            <div className="flex justify-between text-xp-text-muted">
              <span>Smallest:</span>
              <span>{formatSize(sizeStats.min)}</span>
            </div>
            <div className="flex justify-between text-xp-text-muted">
              <span>Largest:</span>
              <span>{formatSize(sizeStats.max)}</span>
            </div>
            <div className="flex justify-between text-xp-text-muted">
              <span>Average:</span>
              <span>{formatSize(sizeStats.avg)}</span>
            </div>
          </div>

          {/* Presets */}
          <div>
            <h3 className="text-sm font-medium text-xp-text-muted mb-2">Quick Select</h3>
            <div className="grid grid-cols-2 gap-2">
              {SIZE_RANGE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-2 text-sm rounded-md transition-colors text-left ${
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

          {/* Custom Size Range */}
          <div>
            <h3 className="text-sm font-medium text-xp-text-muted mb-2">Custom Range</h3>
            <div className="space-y-3">
              {/* Min Size */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-xp-text-muted w-12">Min:</span>
                <input
                  type="number"
                  value={minValue}
                  onChange={(e) => {
                    setMinValue(e.target.value);
                    setSelectedPreset(null);
                  }}
                  min="0"
                  placeholder="0"
                  className="flex-1 px-3 py-2 bg-xp-bg border border-xp-border rounded-md text-sm"
                />
                <select
                  value={minUnit}
                  onChange={(e) => setMinUnit(e.target.value as SizeUnit)}
                  className="px-3 py-2 bg-xp-bg border border-xp-border rounded-md text-sm"
                >
                  <option value="B">B</option>
                  <option value="KB">KB</option>
                  <option value="MB">MB</option>
                  <option value="GB">GB</option>
                </select>
              </div>

              {/* Max Size */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-xp-text-muted w-12">Max:</span>
                <input
                  type="number"
                  value={maxValue}
                  onChange={(e) => {
                    setMaxValue(e.target.value);
                    setSelectedPreset(null);
                    setIncludeUnlimited(false);
                  }}
                  min="0"
                  placeholder="No limit"
                  disabled={includeUnlimited}
                  className="flex-1 px-3 py-2 bg-xp-bg border border-xp-border rounded-md text-sm disabled:opacity-50"
                />
                <select
                  value={maxUnit}
                  onChange={(e) => setMaxUnit(e.target.value as SizeUnit)}
                  disabled={includeUnlimited}
                  className="px-3 py-2 bg-xp-bg border border-xp-border rounded-md text-sm disabled:opacity-50"
                >
                  <option value="B">B</option>
                  <option value="KB">KB</option>
                  <option value="MB">MB</option>
                  <option value="GB">GB</option>
                </select>
              </div>

              {/* No Limit Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUnlimited}
                  onChange={(e) => {
                    setIncludeUnlimited(e.target.checked);
                    if (e.target.checked) {
                      setMaxValue('');
                    }
                  }}
                  className="rounded border-xp-border"
                />
                <span className="text-sm text-xp-text-muted">No maximum limit</span>
              </label>
            </div>
          </div>

          {/* Preview Count */}
          <div className="flex items-center justify-between p-3 bg-xp-primary/10 border border-xp-primary/30 rounded-md">
            <span className="text-sm text-xp-text">Files matching:</span>
            <span className="text-lg font-semibold text-xp-primary">{matchCount}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-xp-border">
          <button onClick={clearValues} className="text-sm text-xp-text-muted hover:text-xp-text">
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
              disabled={matchCount === 0}
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
