import React, { useState, useMemo } from 'react';
import { FileEntry } from '@/lib/tauri-api';
import { COMMON_FILE_TYPES } from './types';
import { getUniqueExtensions, countByExtension } from './selection-utils';

interface SelectByExtensionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (extensions: string[]) => void;
  files: FileEntry[];
}

export const SelectByExtensionDialog = ({
  isOpen,
  onClose,
  onSelect,
  files,
}: SelectByExtensionDialogProps) => {
  const [selectedExtensions, setSelectedExtensions] = useState<Set<string>>(new Set());
  const [customExtension, setCustomExtension] = useState('');

  // Get extensions present in current directory
  const availableExtensions = useMemo(() => getUniqueExtensions(files), [files]);
  const extensionCounts = useMemo(() => countByExtension(files), [files]);

  // Filter common file types to only show those with files present
  const relevantFileTypes = useMemo(() => {
    return COMMON_FILE_TYPES.filter((type) =>
      type.extensions.some((ext) => availableExtensions.includes(ext)),
    );
  }, [availableExtensions]);

  const toggleExtension = (ext: string) => {
    const newSet = new Set(selectedExtensions);
    if (newSet.has(ext)) {
      newSet.delete(ext);
    } else {
      newSet.add(ext);
    }
    setSelectedExtensions(newSet);
  };

  const selectCategory = (extensions: string[]) => {
    const newSet = new Set(selectedExtensions);
    const relevant = extensions.filter((ext) => availableExtensions.includes(ext));
    relevant.forEach((ext) => newSet.add(ext));
    setSelectedExtensions(newSet);
  };

  const addCustomExtension = () => {
    if (customExtension.trim()) {
      const ext = customExtension.trim().replace(/^\./, '').toLowerCase();
      const newSet = new Set(selectedExtensions);
      newSet.add(ext);
      setSelectedExtensions(newSet);
      setCustomExtension('');
    }
  };

  const handleSelect = () => {
    if (selectedExtensions.size > 0) {
      onSelect(Array.from(selectedExtensions));
    }
    onClose();
  };

  const clearSelection = () => {
    setSelectedExtensions(new Set());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-xp-surface border border-xp-border rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-xp-border">
          <h2 className="text-lg font-semibold text-xp-text">Select by File Type</h2>
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
          {/* Quick Categories */}
          {relevantFileTypes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-xp-text-muted mb-2">Quick Select</h3>
              <div className="flex flex-wrap gap-2">
                {relevantFileTypes.map((type) => (
                  <button
                    key={type.label}
                    onClick={() => selectCategory(type.extensions)}
                    className="px-3 py-1.5 text-sm bg-xp-bg hover:bg-xp-primary/20 border border-xp-border rounded-md transition-colors"
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Available Extensions */}
          <div>
            <h3 className="text-sm font-medium text-xp-text-muted mb-2">
              Extensions in this folder ({availableExtensions.length})
            </h3>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {availableExtensions.map((ext) => (
                <label
                  key={ext}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                    selectedExtensions.has(ext)
                      ? 'bg-xp-primary/20 border border-xp-primary'
                      : 'bg-xp-bg hover:bg-xp-surface-light border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedExtensions.has(ext)}
                    onChange={() => toggleExtension(ext)}
                    className="rounded border-xp-border"
                  />
                  <span className="text-sm">.{ext}</span>
                  <span className="text-xs text-xp-text-muted ml-auto">
                    ({extensionCounts.get(ext) || 0})
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Extension */}
          <div>
            <h3 className="text-sm font-medium text-xp-text-muted mb-2">Custom Extension</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={customExtension}
                onChange={(e) => setCustomExtension(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomExtension()}
                placeholder="e.g., txt or .md"
                className="flex-1 px-3 py-2 bg-xp-bg border border-xp-border rounded-md text-sm"
              />
              <button
                onClick={addCustomExtension}
                disabled={!customExtension.trim()}
                className="px-4 py-2 bg-xp-primary text-white rounded-md text-sm disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Selected Extensions */}
          {selectedExtensions.size > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-xp-text-muted">
                  Selected ({selectedExtensions.size})
                </h3>
                <button
                  onClick={clearSelection}
                  className="text-xs text-xp-text-muted hover:text-xp-text"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.from(selectedExtensions).map((ext) => (
                  <span
                    key={ext}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-xp-primary/20 text-xp-primary rounded text-sm"
                  >
                    .{ext}
                    <button onClick={() => toggleExtension(ext)} className="hover:text-xp-text">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-xp-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-xp-text-muted hover:text-xp-text"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={selectedExtensions.size === 0}
            className="px-4 py-2 bg-xp-primary text-white rounded-md text-sm disabled:opacity-50"
          >
            Select Files
          </button>
        </div>
      </div>
    </div>
  );
}
