import React, { useState, useEffect, useRef } from 'react';
import { TauriAPI, type FileTag } from '@/lib/tauri-api';
import { Tag, X, Plus, Check } from 'lucide-react';

const PRESET_COLORS: { label: string; value: string }[] = [
  { label: 'Blue', value: '#7aa2f7' },
  { label: 'Green', value: '#9ece6a' },
  { label: 'Red', value: '#f7768e' },
  { label: 'Orange', value: '#ff9e64' },
  { label: 'Purple', value: '#bb9af7' },
  { label: 'Yellow', value: '#e0af68' },
];

interface FileTagsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  /** Optional callback fired after tags have been saved successfully. */
  onSaved?: (tags: FileTag[]) => void;
}

const FileTagsDialog = ({
  isOpen,
  onClose,
  filePath,
  onSaved,
}: FileTagsDialogProps) => {
  const [tags, setTags] = useState<FileTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load existing tags when dialog opens
  useEffect(() => {
    if (!isOpen || !filePath) return;
    setError(null);
    setNewTagName('');
    setSelectedColor(PRESET_COLORS[0].value);

    setLoading(true);
    TauriAPI.getFileTags(filePath)
      .then(setTags)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [isOpen, filePath]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleAddTag = () => {
    const name = newTagName.trim();
    if (!name) return;

    // Prevent duplicate names
    if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setError(`Tag "${name}" already exists on this file.`);
      return;
    }

    setTags((prev) => [...prev, { name, color: selectedColor }]);
    setNewTagName('');
    setError(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleRemoveTag = (index: number) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await TauriAPI.setFileTags(filePath, tags);
      onSaved?.(tags);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Dialog */}
      <div className="bg-xp-surface border border-xp-border rounded-lg shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-xp-border">
          <div className="flex items-center space-x-2">
            <Tag className="w-4 h-4 text-xp-text-muted" />
            <div>
              <h2 className="text-sm font-semibold text-xp-text">Manage Tags</h2>
              <p className="text-xs text-xp-text-muted truncate max-w-xs" title={filePath}>
                {fileName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text transition-colors"
            aria-label="Close tags dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-4">
          {/* Current tags */}
          <div>
            <p className="text-xs font-medium text-xp-text-muted mb-2 uppercase tracking-wide">
              Current Tags
            </p>
            {loading ? (
              <p className="text-sm text-xp-text-muted">Loading...</p>
            ) : tags.length === 0 ? (
              <p className="text-sm text-xp-text-muted italic">No tags — add one below.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center space-x-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    <span>{tag.name}</span>
                    <button
                      onClick={() => handleRemoveTag(idx)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-black hover:bg-opacity-20 transition-colors"
                      title={`Remove "${tag.name}"`}
                      aria-label={`Remove tag "${tag.name}"`}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-xp-border" />

          {/* Add new tag */}
          <div>
            <p className="text-xs font-medium text-xp-text-muted mb-2 uppercase tracking-wide">
              Add Tag
            </p>

            {/* Color picker */}
            <div className="flex items-center space-x-1.5 mb-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setSelectedColor(c.value)}
                  className="w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center"
                  style={{
                    backgroundColor: c.value,
                    borderColor: selectedColor === c.value ? 'white' : 'transparent',
                    boxShadow: selectedColor === c.value ? `0 0 0 1px ${c.value}` : 'none',
                  }}
                  title={c.label}
                  aria-label={`Select ${c.label} color`}
                >
                  {selectedColor === c.value && (
                    <Check className="w-2.5 h-2.5 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>

            {/* Tag name input */}
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <span
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: selectedColor }}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={newTagName}
                  onChange={(e) => {
                    setNewTagName(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Tag name..."
                  maxLength={32}
                  className="w-full bg-xp-bg border border-xp-border rounded pl-7 pr-3 py-1.5 text-sm text-xp-text placeholder-xp-text-muted focus:outline-none focus:ring-2 focus:ring-xp-blue focus:border-xp-blue transition-colors"
                />
              </div>
              <button
                onClick={handleAddTag}
                disabled={!newTagName.trim()}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-xp-blue text-white rounded text-sm font-medium hover:bg-opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Add tag"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-400 bg-opacity-10 border border-red-400 border-opacity-30 rounded px-2 py-1">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2 px-4 py-3 border-t border-xp-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light rounded transition-colors"
            aria-label="Cancel tag changes"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-xp-blue text-white rounded text-sm font-medium hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Save tags"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save Tags</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileTagsDialog;
