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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-xp-surface border-xp-border flex max-h-[80vh] w-[500px] flex-col rounded-lg border shadow-xl">
        {/* Header */}
        <div className="border-xp-border flex items-center justify-between border-b p-4">
          <h2 className="text-xp-text text-lg font-semibold">Select by File Type</h2>
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
          {/* Quick Categories */}
          {relevantFileTypes.length > 0 && (
            <div>
              <h3 className="text-xp-text-muted mb-2 text-sm font-medium">Quick Select</h3>
              <div className="flex flex-wrap gap-2">
                {relevantFileTypes.map((type) => (
                  <button
                    key={type.label}
                    onClick={() => selectCategory(type.extensions)}
                    className="bg-xp-bg hover:bg-xp-primary/20 border-xp-border rounded-md border px-3 py-1.5 text-sm transition-colors"
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Available Extensions */}
          <div>
            <h3 className="text-xp-text-muted mb-2 text-sm font-medium">
              Extensions in this folder ({availableExtensions.length})
            </h3>
            <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto">
              {availableExtensions.map((ext) => (
                <label
                  key={ext}
                  className={`flex cursor-pointer items-center gap-2 rounded p-2 transition-colors ${
                    selectedExtensions.has(ext)
                      ? 'bg-xp-primary/20 border-xp-primary border'
                      : 'bg-xp-bg hover:bg-xp-surface-light border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedExtensions.has(ext)}
                    onChange={() => toggleExtension(ext)}
                    className="border-xp-border rounded"
                  />
                  <span className="text-sm">.{ext}</span>
                  <span className="text-xp-text-muted ml-auto text-xs">
                    ({extensionCounts.get(ext) || 0})
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Extension */}
          <div>
            <h3 className="text-xp-text-muted mb-2 text-sm font-medium">Custom Extension</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={customExtension}
                onChange={(e) => setCustomExtension(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomExtension()}
                placeholder="e.g., txt or .md"
                className="bg-xp-bg border-xp-border flex-1 rounded-md border px-3 py-2 text-sm"
              />
              <button
                onClick={addCustomExtension}
                disabled={!customExtension.trim()}
                className="bg-xp-primary rounded-md px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {/* Selected Extensions */}
          {selectedExtensions.size > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xp-text-muted text-sm font-medium">
                  Selected ({selectedExtensions.size})
                </h3>
                <button
                  onClick={clearSelection}
                  className="text-xp-text-muted hover:text-xp-text text-xs"
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {Array.from(selectedExtensions).map((ext) => (
                  <span
                    key={ext}
                    className="bg-xp-primary/20 text-xp-primary inline-flex items-center gap-1 rounded px-2 py-1 text-sm"
                  >
                    .{ext}
                    <button onClick={() => toggleExtension(ext)} className="hover:text-xp-text">
                      <svg
                        className="h-3 w-3"
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
        <div className="border-xp-border flex items-center justify-end gap-2 border-t p-4">
          <button
            onClick={onClose}
            className="text-xp-text-muted hover:text-xp-text px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={selectedExtensions.size === 0}
            className="bg-xp-primary rounded-md px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            Select Files
          </button>
        </div>
      </div>
    </div>
  );
};
