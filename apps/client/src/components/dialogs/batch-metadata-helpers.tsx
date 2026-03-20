import React from 'react';
import { type FileTag, type FileNote, type FileEntry } from '@/lib/tauri-api';
import { Tag, X, Plus, Check, StickyNote, FileText } from 'lucide-react';
import { getFileIcon } from '@/lib/utils';

// ── Constants ────────────────────────────────────────────────────────────────

export const PRESET_COLORS: { label: string; value: string }[] = [
  { label: 'Blue', value: '#7aa2f7' },
  { label: 'Green', value: '#9ece6a' },
  { label: 'Red', value: '#f7768e' },
  { label: 'Orange', value: '#ff9e64' },
  { label: 'Purple', value: '#bb9af7' },
  { label: 'Yellow', value: '#e0af68' },
  { label: 'Teal', value: '#73daca' },
  { label: 'Pink', value: '#ff7eb6' },
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface BatchMetadataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileEntry[];
  onComplete?: () => void;
}

export type ActiveTab = 'tags' | 'notes';

// ── Shared sub-components ────────────────────────────────────────────────────

export const SectionHeader = ({ label }: { label: string }) => {
  return (
    <p
      style={{
        fontSize: '10px',
        fontWeight: 600,
        color: 'var(--xp-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        margin: '0 0 6px 0',
      }}
    >
      {label}
    </p>
  );
};

export const TagPill = ({
  tag,
  onRemove,
  highlight,
  prefix,
}: {
  tag: FileTag;
  onRemove?: () => void;
  highlight?: boolean;
  prefix?: string;
}) => {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 500,
        color: '#fff',
        backgroundColor: tag.color,
        border: highlight ? '1px solid rgba(255,255,255,0.3)' : 'none',
      }}
    >
      {prefix && <span style={{ opacity: 0.7 }}>{prefix}</span>}
      {tag.name}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            padding: '0',
            marginLeft: '2px',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label={`Remove "${tag.name}"`}
        >
          <X style={{ width: '10px', height: '10px' }} />
        </button>
      )}
    </span>
  );
};

// ── Tags Panel ───────────────────────────────────────────────────────────────

export interface TagsPanelProps {
  pendingTagsToAdd: FileTag[];
  pendingTagsToRemove: string[];
  commonTags: FileTag[];
  removableTags: FileTag[];
  availableSystemTags: FileTag[];
  newTagName: string;
  setNewTagName: (v: string) => void;
  selectedColor: string;
  setSelectedColor: (v: string) => void;
  handleAddNewTag: () => void;
  handleRemoveFromPendingAdd: (name: string) => void;
  handleAddToRemoveList: (name: string) => void;
  handleUndoRemove: (name: string) => void;
  handleQuickAddSystemTag: (tag: FileTag) => void;
  handleTagInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  tagInputRef: React.RefObject<HTMLInputElement>;
  error: string | null;
  setError: (v: string | null) => void;
}

export const TagsPanel = ({
  pendingTagsToAdd,
  pendingTagsToRemove,
  commonTags,
  removableTags,
  availableSystemTags,
  newTagName,
  setNewTagName,
  selectedColor,
  setSelectedColor,
  handleAddNewTag,
  handleRemoveFromPendingAdd,
  handleAddToRemoveList,
  handleUndoRemove,
  handleQuickAddSystemTag,
  handleTagInputKeyDown,
  tagInputRef,
  error,
  setError,
}: TagsPanelProps) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Common Tags (shared by all files) */}
      {commonTags.length > 0 && (
        <div>
          <SectionHeader label="Common Tags (on all files)" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {commonTags.map((tag) => (
              <TagPill key={tag.name} tag={tag} highlight />
            ))}
          </div>
        </div>
      )}

      {/* Add to All */}
      <div>
        <SectionHeader label="Add to All Files" />

        {/* Tags queued for adding */}
        {pendingTagsToAdd.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            {pendingTagsToAdd.map((tag) => (
              <TagPill
                key={tag.name}
                tag={tag}
                onRemove={() => handleRemoveFromPendingAdd(tag.name)}
                prefix="+"
              />
            ))}
          </div>
        )}

        {/* Color picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          {PRESET_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setSelectedColor(c.value)}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: selectedColor === c.value ? '2px solid white' : '2px solid transparent',
                backgroundColor: c.value,
                boxShadow: selectedColor === c.value ? `0 0 0 1px ${c.value}` : 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
              title={c.label}
              aria-label={`Select ${c.label} color`}
            >
              {selectedColor === c.value && (
                <Check
                  style={{
                    width: '10px',
                    height: '10px',
                    color: 'white',
                    filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.5))',
                  }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tag input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span
              style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: selectedColor,
              }}
            />
            <input
              ref={tagInputRef}
              type="text"
              value={newTagName}
              onChange={(e) => {
                setNewTagName(e.target.value);
                setError(null);
              }}
              onKeyDown={handleTagInputKeyDown}
              placeholder="Tag name..."
              maxLength={32}
              style={{
                width: '100%',
                backgroundColor: 'var(--xp-bg)',
                border: '1px solid var(--xp-border)',
                borderRadius: '6px',
                padding: '5px 10px 5px 22px',
                fontSize: '12px',
                color: 'var(--xp-text)',
                outline: 'none',
              }}
            />
          </div>
          <button
            onClick={handleAddNewTag}
            disabled={!newTagName.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#fff',
              backgroundColor: newTagName.trim() ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
              border: 'none',
              borderRadius: '6px',
              cursor: newTagName.trim() ? 'pointer' : 'not-allowed',
              opacity: newTagName.trim() ? 1 : 0.4,
            }}
          >
            <Plus style={{ width: '12px', height: '12px' }} />
            Add
          </button>
        </div>
      </div>

      {/* Remove from All */}
      {removableTags.length > 0 && (
        <div>
          <SectionHeader label="Remove from All Files" />
          <p style={{ fontSize: '11px', color: 'var(--xp-text-muted)', margin: '0 0 6px 0' }}>
            Click a tag to mark it for removal.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {removableTags.map((tag) => (
              <button
                key={tag.name}
                onClick={() => handleAddToRemoveList(tag.name)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#fff',
                  backgroundColor: tag.color,
                  border: 'none',
                  cursor: 'pointer',
                  opacity: 0.85,
                }}
                title={`Click to remove "${tag.name}" from all files`}
              >
                {tag.name}
                <X style={{ width: '10px', height: '10px' }} />
              </button>
            ))}
          </div>

          {/* Show pending removes with undo */}
          {pendingTagsToRemove.length > 0 && (
            <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {pendingTagsToRemove.map((name) => (
                <span
                  key={name}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--xp-text-muted)',
                    backgroundColor: 'rgba(247, 118, 142, 0.15)',
                    border: '1px solid rgba(247, 118, 142, 0.3)',
                    textDecoration: 'line-through',
                  }}
                >
                  {name}
                  <button
                    onClick={() => handleUndoRemove(name)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--xp-text-muted)',
                      cursor: 'pointer',
                      fontSize: '10px',
                    }}
                    title="Undo remove"
                  >
                    undo
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Available System Tags */}
      {availableSystemTags.length > 0 && (
        <div>
          <SectionHeader label="Available Tags" />
          <p style={{ fontSize: '11px', color: 'var(--xp-text-muted)', margin: '0 0 6px 0' }}>
            Click to add to all files.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {availableSystemTags.map((tag) => (
              <button
                key={tag.name}
                onClick={() => handleQuickAddSystemTag(tag)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#fff',
                  backgroundColor: tag.color,
                  border: 'none',
                  cursor: 'pointer',
                  opacity: 0.7,
                }}
                title={`Add "${tag.name}" to all files`}
              >
                <Plus style={{ width: '10px', height: '10px' }} />
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p
          style={{
            fontSize: '11px',
            color: '#f7768e',
            backgroundColor: 'rgba(247, 118, 142, 0.1)',
            border: '1px solid rgba(247, 118, 142, 0.3)',
            borderRadius: '4px',
            padding: '4px 8px',
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
};

// ── Notes Panel ──────────────────────────────────────────────────────────────

export interface NotesPanelProps {
  fileNotes: Record<string, FileNote[]>;
  files: FileEntry[];
  noteTitle: string;
  setNoteTitle: (v: string) => void;
  noteContent: string;
  setNoteContent: (v: string) => void;
  noteMode: 'replace' | 'append';
  setNoteMode: (v: 'replace' | 'append') => void;
}

export const NotesPanel = ({
  fileNotes,
  files,
  noteTitle,
  setNoteTitle,
  noteContent,
  setNoteContent,
  noteMode,
  setNoteMode,
}: NotesPanelProps) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Mode toggle */}
      <div>
        <SectionHeader label="Mode" />
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['append', 'replace'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setNoteMode(mode)}
              style={{
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: noteMode === mode ? 600 : 400,
                color: noteMode === mode ? '#fff' : 'var(--xp-text-muted)',
                backgroundColor: noteMode === mode ? 'var(--xp-blue)' : 'var(--xp-bg)',
                border: `1px solid ${noteMode === mode ? 'var(--xp-blue)' : 'var(--xp-border)'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
        <p style={{ fontSize: '10px', color: 'var(--xp-text-muted)', margin: '4px 0 0 0' }}>
          {noteMode === 'append'
            ? 'Adds this note to each file, keeping existing notes.'
            : 'Replaces all existing notes on each file with this note.'}
        </p>
      </div>

      {/* Note title */}
      <div>
        <SectionHeader label="Note Title" />
        <input
          type="text"
          value={noteTitle}
          onChange={(e) => setNoteTitle(e.target.value)}
          placeholder="Note title..."
          style={{
            width: '100%',
            backgroundColor: 'var(--xp-bg)',
            border: '1px solid var(--xp-border)',
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '12px',
            color: 'var(--xp-text)',
            outline: 'none',
          }}
        />
      </div>

      {/* Note content */}
      <div>
        <SectionHeader label="Note Content" />
        <textarea
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="Type your note here... This will be applied to all selected files."
          rows={5}
          style={{
            width: '100%',
            backgroundColor: 'var(--xp-bg)',
            border: '1px solid var(--xp-border)',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '12px',
            color: 'var(--xp-text)',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
            lineHeight: '1.5',
          }}
        />
      </div>

      {/* Existing notes preview */}
      <div>
        <SectionHeader label="Current Notes per File" />
        <div
          style={{
            maxHeight: '140px',
            overflowY: 'auto',
            borderRadius: '6px',
            border: '1px solid var(--xp-border)',
            backgroundColor: 'var(--xp-bg)',
          }}
        >
          {files.map((file) => {
            const notes = fileNotes[file.path] || [];
            return (
              <div
                key={file.path}
                style={{
                  padding: '6px 10px',
                  borderBottom: '1px solid var(--xp-border)',
                  fontSize: '11px',
                }}
              >
                <div
                  style={{
                    fontWeight: 500,
                    color: 'var(--xp-text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <FileText
                    style={{
                      width: '10px',
                      height: '10px',
                      color: 'var(--xp-text-muted)',
                      flexShrink: 0,
                    }}
                  />
                  {file.name}
                  <span style={{ color: 'var(--xp-text-muted)', fontWeight: 400 }}>
                    ({notes.length} note{notes.length !== 1 ? 's' : ''})
                  </span>
                </div>
                {notes.length > 0 && (
                  <div
                    style={{
                      color: 'var(--xp-text-muted)',
                      marginTop: '2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {notes.map((n) => n.title).join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
