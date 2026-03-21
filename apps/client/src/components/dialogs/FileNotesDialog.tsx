import React, { useState, useEffect, useRef } from 'react';
import { TauriAPI, type FileNote } from '@/lib/tauri-api';
import {
  StickyNote,
  X,
  Plus,
  Check,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface FileNotesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  onSaved?: () => void;
}

const FileNotesDialog = ({ isOpen, onClose, filePath, onSaved }: FileNotesDialogProps) => {
  const [notes, setNotes] = useState<FileNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  // New note form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !filePath) return;
    setError(null);
    setShowAddForm(false);
    setEditingNoteId(null);
    setExpandedNoteId(null);

    setLoading(true);
    TauriAPI.getFileNotes(filePath)
      .then(setNotes)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [isOpen, filePath]);

  useEffect(() => {
    if (showAddForm) {
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [showAddForm]);

  const handleAddNote = async () => {
    const title = newTitle.trim();
    if (!title) return;

    setSaving(true);
    setError(null);
    try {
      const note = await TauriAPI.addFileNote(filePath, title, newContent);
      setNotes((prev) => [...prev, note]);
      setNewTitle('');
      setNewContent('');
      setShowAddForm(false);
      onSaved?.();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    setSaving(true);
    setError(null);
    try {
      await TauriAPI.updateFileNote(filePath, noteId, editTitle, editContent);
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, title: editTitle, content: editContent, updated_at: new Date().toISOString() }
            : n,
        ),
      );
      setEditingNoteId(null);
      onSaved?.();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    setError(null);
    try {
      await TauriAPI.deleteFileNote(filePath, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (editingNoteId === noteId) setEditingNoteId(null);
      if (expandedNoteId === noteId) setExpandedNoteId(null);
      onSaved?.();
    } catch (err) {
      setError(String(err));
    }
  };

  const startEditing = (note: FileNote) => {
    setEditingNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setExpandedNoteId(note.id);
  };

  if (!isOpen) return null;

  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-xp-surface border-xp-border mx-4 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border shadow-2xl">
        {/* Header */}
        <div className="border-xp-border flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="flex items-center space-x-2">
            <StickyNote className="text-xp-text-muted h-4 w-4" />
            <div>
              <h2 className="text-xp-text text-sm font-semibold">Notes</h2>
              <p className="text-xp-text-muted max-w-xs truncate text-xs" title={filePath}>
                {fileName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text rounded p-1 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {/* eslint-disable-next-line no-nested-ternary */}
          {loading ? (
            <p className="text-xp-text-muted text-sm">Loading...</p>
          ) : notes.length === 0 && !showAddForm ? (
            <p className="text-xp-text-muted text-sm italic">No notes yet — add one below.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="border-xp-border overflow-hidden rounded-md border">
                {/* Note header */}
                <button
                  className="hover:bg-xp-surface-light flex w-full items-center justify-between px-3 py-2 text-left transition-colors"
                  onClick={() => setExpandedNoteId(expandedNoteId === note.id ? null : note.id)}
                >
                  <div className="flex min-w-0 items-center space-x-2">
                    {expandedNoteId === note.id ? (
                      <ChevronDown className="text-xp-text-muted h-3.5 w-3.5 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="text-xp-text-muted h-3.5 w-3.5 flex-shrink-0" />
                    )}
                    <span className="text-xp-text truncate text-sm font-medium">{note.title}</span>
                  </div>
                  <div className="ml-2 flex flex-shrink-0 items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(note);
                      }}
                      className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-blue rounded p-1 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id);
                      }}
                      className="hover:bg-xp-surface-light text-xp-text-muted rounded p-1 transition-colors hover:text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </button>

                {/* Expanded content */}
                {expandedNoteId === note.id && (
                  <div className="border-xp-border border-t px-3 pb-3">
                    {editingNoteId === note.id ? (
                      <div className="space-y-2 pt-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="bg-xp-bg border-xp-border text-xp-text focus:border-xp-blue w-full rounded border px-3 py-1.5 text-sm transition-colors focus:outline-none"
                          placeholder="Title"
                        />
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={5}
                          className="bg-xp-bg border-xp-border text-xp-text focus:border-xp-blue w-full resize-y rounded border px-3 py-1.5 text-sm transition-colors focus:outline-none"
                          placeholder="Note content (markdown supported)..."
                        />
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setEditingNoteId(null)}
                            className="text-xp-text-muted hover:text-xp-text rounded px-2.5 py-1 text-xs transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdateNote(note.id)}
                            disabled={saving || !editTitle.trim()}
                            className="bg-xp-blue flex items-center space-x-1 rounded px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-opacity-90 disabled:opacity-40"
                          >
                            <Check className="h-3 w-3" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2">
                        <p className="text-xp-text whitespace-pre-wrap text-sm">
                          {note.content || (
                            <span className="text-xp-text-muted italic">No content</span>
                          )}
                        </p>
                        <p className="text-xp-text-muted mt-2 text-xs">
                          Updated {new Date(note.updated_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Add note form */}
          {showAddForm && (
            <div className="border-xp-blue space-y-2 rounded-md border border-opacity-50 p-3">
              <input
                ref={titleInputRef}
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowAddForm(false);
                }}
                className="bg-xp-bg border-xp-border text-xp-text placeholder-xp-text-muted focus:border-xp-blue w-full rounded border px-3 py-1.5 text-sm transition-colors focus:outline-none"
                placeholder="Note title..."
                maxLength={100}
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={4}
                className="bg-xp-bg border-xp-border text-xp-text placeholder-xp-text-muted focus:border-xp-blue w-full resize-y rounded border px-3 py-1.5 text-sm transition-colors focus:outline-none"
                placeholder="Note content (markdown supported)..."
              />
              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="text-xp-text-muted hover:text-xp-text rounded px-2.5 py-1 text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNote}
                  disabled={saving || !newTitle.trim()}
                  className="bg-xp-blue flex items-center space-x-1 rounded px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-opacity-90 disabled:opacity-40"
                >
                  {saving ? (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  <span>Add Note</span>
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="rounded border border-red-400 border-opacity-30 bg-red-400 bg-opacity-10 px-2 py-1 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-xp-border flex flex-shrink-0 items-center justify-between border-t px-4 py-3">
          <span className="text-xp-text-muted text-xs">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center space-x-2">
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-xp-blue flex items-center space-x-1.5 rounded px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Note</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light rounded px-3 py-1.5 text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileNotesDialog;
