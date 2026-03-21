import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TauriAPI, type FileTag, type FileNote } from '@/lib/tauri-api';
import { Tag, X, Check, StickyNote, Loader2 } from 'lucide-react';
import { getFileIcon } from '@/lib/utils';
import {
  PRESET_COLORS,
  TagsPanel,
  NotesPanel,
  type BatchMetadataDialogProps,
  type ActiveTab,
} from './batch-metadata-helpers';

// ── Component ────────────────────────────────────────────────────────────────

const BatchMetadataDialog = React.memo(function BatchMetadataDialog({
  isOpen,
  onClose,
  files,
  onComplete,
}: BatchMetadataDialogProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('tags');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Tag state
  const [fileTags, setFileTags] = useState<Record<string, FileTag[]>>({});
  const [allSystemTags, setAllSystemTags] = useState<FileTag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].value);
  const [pendingTagsToAdd, setPendingTagsToAdd] = useState<FileTag[]>([]);
  const [pendingTagsToRemove, setPendingTagsToRemove] = useState<string[]>([]);

  // Notes state
  const [fileNotes, setFileNotes] = useState<Record<string, FileNote[]>>({});
  const [noteTitle, setNoteTitle] = useState('Batch Note');
  const [noteContent, setNoteContent] = useState('');
  const [noteMode, setNoteMode] = useState<'replace' | 'append'>('append');

  const tagInputRef = useRef<HTMLInputElement>(null);

  const filePaths = useMemo(() => files.map((f) => f.path), [files]);

  // ── Load data when dialog opens ──────────────────────────────────────

  useEffect(() => {
    if (!isOpen || files.length === 0) return;

    setLoading(true);
    setError(null);
    setPendingTagsToAdd([]);
    setPendingTagsToRemove([]);
    setNoteContent('');
    setNoteTitle('Batch Note');
    setNoteMode('append');
    setProgress(0);
    setApplying(false);
    setActiveTab('tags');

    const loadData = async () => {
      try {
        const [tagsMap, allTags, ...notesArrays] = await Promise.all([
          TauriAPI.getFileTagsBatch(filePaths),
          TauriAPI.getAllFileTags(),
          ...filePaths.map((p) => TauriAPI.getFileNotes(p)),
        ]);

        setFileTags(tagsMap);
        setAllSystemTags(allTags);

        const notesMap: Record<string, FileNote[]> = {};
        filePaths.forEach((p, i) => {
          notesMap[p] = notesArrays[i] || [];
        });
        setFileNotes(notesMap);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, filePaths, files.length]);

  // ── Computed tag data ────────────────────────────────────────────────

  /** All tags that appear on at least one selected file */
  const allExistingTags = useMemo(() => {
    const tagMap = new Map<string, FileTag>();
    for (const tags of Object.values(fileTags)) {
      for (const tag of tags) {
        if (!tagMap.has(tag.name)) {
          tagMap.set(tag.name, tag);
        }
      }
    }
    return Array.from(tagMap.values());
  }, [fileTags]);

  /** Tags shared by ALL selected files */
  const commonTags = useMemo(() => {
    if (files.length === 0) return [];
    return allExistingTags.filter((tag) =>
      filePaths.every((p) => (fileTags[p] || []).some((t) => t.name === tag.name)),
    );
  }, [allExistingTags, filePaths, fileTags, files.length]);

  /** Tags available in the system that are not already being added */
  const availableSystemTags = useMemo(() => {
    const pendingNames = new Set(pendingTagsToAdd.map((t) => t.name));
    return allSystemTags.filter((t) => !pendingNames.has(t.name));
  }, [allSystemTags, pendingTagsToAdd]);

  /** Tags to show in the "Remove from All" section: existing tags minus pending removes */
  const removableTags = useMemo(() => {
    return allExistingTags.filter((t) => !pendingTagsToRemove.includes(t.name));
  }, [allExistingTags, pendingTagsToRemove]);

  // ── Change summary ───────────────────────────────────────────────────

  const changeSummary = useMemo(() => {
    const parts: string[] = [];
    if (pendingTagsToAdd.length > 0) {
      parts.push(`+${pendingTagsToAdd.length} tag${pendingTagsToAdd.length > 1 ? 's' : ''}`);
    }
    if (pendingTagsToRemove.length > 0) {
      parts.push(`-${pendingTagsToRemove.length} tag${pendingTagsToRemove.length > 1 ? 's' : ''}`);
    }
    if (noteContent.trim()) {
      parts.push(
        `notes ${noteMode === 'replace' ? 'replaced' : 'appended'} for ${files.length} files`,
      );
    }
    return parts.length > 0 ? parts.join(', ') : 'No changes';
  }, [pendingTagsToAdd, pendingTagsToRemove, noteContent, noteMode, files.length]);

  const hasChanges =
    pendingTagsToAdd.length > 0 || pendingTagsToRemove.length > 0 || noteContent.trim().length > 0;

  // ── Tag actions ──────────────────────────────────────────────────────

  const handleAddNewTag = useCallback(() => {
    const name = newTagName.trim();
    if (!name) return;
    if (pendingTagsToAdd.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setError(`Tag "${name}" is already queued to add.`);
      return;
    }
    setPendingTagsToAdd((prev) => [...prev, { name, color: selectedColor }]);
    setNewTagName('');
    setError(null);
    tagInputRef.current?.focus();
  }, [newTagName, selectedColor, pendingTagsToAdd]);

  const handleRemoveFromPendingAdd = useCallback((name: string) => {
    setPendingTagsToAdd((prev) => prev.filter((t) => t.name !== name));
  }, []);

  const handleAddToRemoveList = useCallback((tagName: string) => {
    setPendingTagsToRemove((prev) => (prev.includes(tagName) ? prev : [...prev, tagName]));
  }, []);

  const handleUndoRemove = useCallback((tagName: string) => {
    setPendingTagsToRemove((prev) => prev.filter((n) => n !== tagName));
  }, []);

  const handleQuickAddSystemTag = useCallback(
    (tag: FileTag) => {
      if (pendingTagsToAdd.some((t) => t.name === tag.name)) return;
      setPendingTagsToAdd((prev) => [...prev, tag]);
    },
    [pendingTagsToAdd],
  );

  const handleTagInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddNewTag();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleAddNewTag, onClose],
  );

  // ── Apply changes ────────────────────────────────────────────────────

  const handleApply = useCallback(async () => {
    setApplying(true);
    setError(null);
    setProgress(0);

    try {
      let step = 0;
      const totalSteps =
        (pendingTagsToAdd.length > 0 ? 1 : 0) +
        (pendingTagsToRemove.length > 0 ? 1 : 0) +
        (noteContent.trim() ? 1 : 0);

      // Add tags
      if (pendingTagsToAdd.length > 0) {
        await TauriAPI.batchAddTags(filePaths, pendingTagsToAdd);
        step++;
        setProgress(Math.round((step / totalSteps) * 100));
      }

      // Remove tags
      if (pendingTagsToRemove.length > 0) {
        await TauriAPI.batchRemoveTags(filePaths, pendingTagsToRemove);
        step++;
        setProgress(Math.round((step / totalSteps) * 100));
      }

      // Set notes
      if (noteContent.trim()) {
        await TauriAPI.batchSetNotes(
          filePaths,
          noteTitle.trim() || 'Note',
          noteContent.trim(),
          noteMode,
        );
        step++;
        setProgress(Math.round((step / totalSteps) * 100));
      }

      setProgress(100);
      onComplete?.();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setApplying(false);
    }
  }, [
    filePaths,
    pendingTagsToAdd,
    pendingTagsToRemove,
    noteContent,
    noteTitle,
    noteMode,
    onClose,
    onComplete,
  ]);

  // ── Render ───────────────────────────────────────────────────────────

  if (!isOpen) return null;

  const tabContent =
    activeTab === 'tags' ? (
      <TagsPanel
        pendingTagsToAdd={pendingTagsToAdd}
        pendingTagsToRemove={pendingTagsToRemove}
        commonTags={commonTags}
        removableTags={removableTags}
        availableSystemTags={availableSystemTags}
        newTagName={newTagName}
        setNewTagName={setNewTagName}
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
        handleAddNewTag={handleAddNewTag}
        handleRemoveFromPendingAdd={handleRemoveFromPendingAdd}
        handleAddToRemoveList={handleAddToRemoveList}
        handleUndoRemove={handleUndoRemove}
        handleQuickAddSystemTag={handleQuickAddSystemTag}
        handleTagInputKeyDown={handleTagInputKeyDown}
        tagInputRef={tagInputRef}
        error={error}
        setError={setError}
      />
    ) : (
      <NotesPanel
        fileNotes={fileNotes}
        files={files}
        noteTitle={noteTitle}
        setNoteTitle={setNoteTitle}
        noteContent={noteContent}
        setNoteContent={setNoteContent}
        noteMode={noteMode}
        setNoteMode={setNoteMode}
      />
    );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '85vh',
          margin: '0 16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--xp-surface)',
          border: '1px solid var(--xp-border)',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--xp-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag style={{ width: '16px', height: '16px', color: 'var(--xp-text-muted)' }} />
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--xp-text)', margin: 0 }}>
                Edit Metadata
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--xp-text-muted)', margin: 0 }}>
                {files.length} file{files.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '4px',
              borderRadius: '4px',
              border: 'none',
              background: 'transparent',
              color: 'var(--xp-text-muted)',
              cursor: 'pointer',
            }}
            aria-label="Close dialog"
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Left: File list */}
          <div
            style={{
              width: '200px',
              flexShrink: 0,
              borderRight: '1px solid var(--xp-border)',
              overflowY: 'auto',
              padding: '8px 0',
            }}
          >
            <p
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--xp-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '0 12px',
                margin: '0 0 4px 0',
              }}
            >
              Selected Files
            </p>
            {files.map((file) => {
              const currentTags = fileTags[file.path] || [];
              return (
                <div
                  key={file.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    fontSize: '12px',
                    color: 'var(--xp-text)',
                  }}
                  title={file.path}
                >
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>{getFileIcon(file)}</span>
                  <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
                    <div
                      style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {file.name}
                    </div>
                    {currentTags.length > 0 && (
                      <div
                        style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', marginTop: '2px' }}
                      >
                        {currentTags.slice(0, 3).map((tag) => (
                          <span
                            key={tag.name}
                            style={{
                              display: 'inline-block',
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: tag.color,
                            }}
                            title={tag.name}
                          />
                        ))}
                        {currentTags.length > 3 && (
                          <span style={{ fontSize: '9px', color: 'var(--xp-text-muted)' }}>
                            +{currentTags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Editor panels */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--xp-border)',
                padding: '0 12px',
              }}
            >
              {(['tags', 'notes'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: activeTab === tab ? 600 : 400,
                    color: activeTab === tab ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
                    background: 'transparent',
                    border: 'none',
                    borderBottom:
                      activeTab === tab ? '2px solid var(--xp-blue)' : '2px solid transparent',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab === 'tags' ? (
                    <Tag style={{ width: '12px', height: '12px' }} />
                  ) : (
                    <StickyNote style={{ width: '12px', height: '12px' }} />
                  )}
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
              {loading ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    gap: '8px',
                    color: 'var(--xp-text-muted)',
                    fontSize: '13px',
                  }}
                >
                  <Loader2
                    style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }}
                  />
                  Loading metadata...
                </div>
              ) : (
                tabContent
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderTop: '1px solid var(--xp-border)',
            gap: '12px',
          }}
        >
          {/* Change summary */}
          <p
            style={{
              fontSize: '11px',
              color: 'var(--xp-text-muted)',
              margin: 0,
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {changeSummary}
          </p>

          {/* Progress bar (when applying) */}
          {applying && (
            <div
              style={{
                width: '120px',
                height: '4px',
                backgroundColor: 'var(--xp-bg)',
                borderRadius: '2px',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: 'var(--xp-blue)',
                  borderRadius: '2px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={onClose}
              disabled={applying}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                color: 'var(--xp-text-muted)',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: applying ? 'not-allowed' : 'pointer',
                opacity: applying ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!hasChanges || applying}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#fff',
                backgroundColor:
                  hasChanges && !applying ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
                border: 'none',
                borderRadius: '6px',
                cursor: hasChanges && !applying ? 'pointer' : 'not-allowed',
                opacity: hasChanges && !applying ? 1 : 0.5,
              }}
            >
              {applying ? (
                <>
                  <Loader2
                    style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }}
                  />
                  Applying...
                </>
              ) : (
                <>
                  <Check style={{ width: '12px', height: '12px' }} />
                  Apply Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global error */}
        {error && activeTab !== 'tags' && (
          <div style={{ padding: '0 16px 10px 16px' }}>
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
          </div>
        )}
      </div>
    </div>
  );
});

export default BatchMetadataDialog;
