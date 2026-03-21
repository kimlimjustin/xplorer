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

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes === Infinity) return 'Unlimited';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
};

export const SelectBySizeDialog = ({
  isOpen,
  onClose,
  onSelect,
  files,
}: SelectBySizeDialogProps) => {
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
    const maxBytes =
      includeUnlimited || !maxValue ? Infinity : parseFloat(maxValue) * UNIT_MULTIPLIERS[maxUnit];

    return files.filter((file) => {
      if (file.is_dir) return false;
      return file.size >= minBytes && (maxBytes === Infinity || file.size <= maxBytes);
    }).length;
  }, [files, minValue, minUnit, maxValue, maxUnit, includeUnlimited]);

  const totalFileCount = useMemo(() => files.filter((f) => !f.is_dir).length, [files]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-xp-surface border-xp-border flex max-h-[80vh] w-[450px] flex-col rounded-lg border shadow-xl">
        {/* Header */}
        <div className="border-xp-border flex items-center justify-between border-b p-4">
          <h2 className="text-xp-text text-lg font-semibold">Select by Size</h2>
          <button onClick={onClose} className="hover:bg-xp-surface-light rounded p-1">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* File Size Info */}
          <div className="bg-xp-bg space-y-1 rounded-md p-3 text-sm">
            <div className="text-xp-text-muted flex justify-between">
              <span>Total files:</span>
              <span>{totalFileCount}</span>
            </div>
            <div className="text-xp-text-muted flex justify-between">
              <span>Smallest:</span>
              <span>{formatSize(sizeStats.min)}</span>
            </div>
            <div className="text-xp-text-muted flex justify-between">
              <span>Largest:</span>
              <span>{formatSize(sizeStats.max)}</span>
            </div>
            <div className="text-xp-text-muted flex justify-between">
              <span>Average:</span>
              <span>{formatSize(sizeStats.avg)}</span>
            </div>
          </div>

          {/* Presets */}
          <div>
            <h3 className="text-xp-text-muted mb-2 text-sm font-medium">Quick Select</h3>
            <div className="grid grid-cols-2 gap-2">
              {SIZE_RANGE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    selectedPreset === preset.label
                      ? 'bg-xp-primary text-white'
                      : 'bg-xp-bg hover:bg-xp-surface-light border-xp-border border'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Size Range */}
          <div>
            <h3 className="text-xp-text-muted mb-2 text-sm font-medium">Custom Range</h3>
            <div className="space-y-3">
              {/* Min Size */}
              <div className="flex items-center gap-2">
                <span className="text-xp-text-muted w-12 text-sm">Min:</span>
                <input
                  type="number"
                  value={minValue}
                  onChange={(e) => {
                    setMinValue(e.target.value);
                    setSelectedPreset(null);
                  }}
                  min="0"
                  placeholder="0"
                  className="bg-xp-bg border-xp-border flex-1 rounded-md border px-3 py-2 text-sm"
                />
                <select
                  value={minUnit}
                  onChange={(e) => setMinUnit(e.target.value as SizeUnit)}
                  className="bg-xp-bg border-xp-border rounded-md border px-3 py-2 text-sm"
                >
                  <option value="B">B</option>
                  <option value="KB">KB</option>
                  <option value="MB">MB</option>
                  <option value="GB">GB</option>
                </select>
              </div>

              {/* Max Size */}
              <div className="flex items-center gap-2">
                <span className="text-xp-text-muted w-12 text-sm">Max:</span>
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
                  className="bg-xp-bg border-xp-border flex-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                />
                <select
                  value={maxUnit}
                  onChange={(e) => setMaxUnit(e.target.value as SizeUnit)}
                  disabled={includeUnlimited}
                  className="bg-xp-bg border-xp-border rounded-md border px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="B">B</option>
                  <option value="KB">KB</option>
                  <option value="MB">MB</option>
                  <option value="GB">GB</option>
                </select>
              </div>

              {/* No Limit Checkbox */}
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeUnlimited}
                  onChange={(e) => {
                    setIncludeUnlimited(e.target.checked);
                    if (e.target.checked) {
                      setMaxValue('');
                    }
                  }}
                  className="border-xp-border rounded"
                />
                <span className="text-xp-text-muted text-sm">No maximum limit</span>
              </label>
            </div>
          </div>

          {/* Preview Count */}
          <div className="bg-xp-primary/10 border-xp-primary/30 flex items-center justify-between rounded-md border p-3">
            <span className="text-xp-text text-sm">Files matching:</span>
            <span className="text-xp-primary text-lg font-semibold">{matchCount}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="border-xp-border flex items-center justify-between border-t p-4">
          <button onClick={clearValues} className="text-xp-text-muted hover:text-xp-text text-sm">
            Clear
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-xp-text-muted hover:text-xp-text px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSelect}
              disabled={matchCount === 0}
              className="bg-xp-primary rounded-md px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Select {matchCount} Files
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
