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

const FileNotesDialog = ({
  isOpen,
  onClose,
  filePath,
  onSaved,
}: FileNotesDialogProps) => {
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
      <div className="bg-xp-surface border border-xp-border rounded-lg shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-xp-border flex-shrink-0">
          <div className="flex items-center space-x-2">
            <StickyNote className="w-4 h-4 text-xp-text-muted" />
            <div>
              <h2 className="text-sm font-semibold text-xp-text">Notes</h2>
              <p className="text-xs text-xp-text-muted truncate max-w-xs" title={filePath}>
                {fileName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loading ? (
            <p className="text-sm text-xp-text-muted">Loading...</p>
          ) : notes.length === 0 && !showAddForm ? (
            <p className="text-sm text-xp-text-muted italic">No notes yet — add one below.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="border border-xp-border rounded-md overflow-hidden">
                {/* Note header */}
                <button
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-xp-surface-light transition-colors text-left"
                  onClick={() => setExpandedNoteId(expandedNoteId === note.id ? null : note.id)}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    {expandedNoteId === note.id ? (
                      <ChevronDown className="w-3.5 h-3.5 text-xp-text-muted flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-xp-text-muted flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-xp-text truncate">{note.title}</span>
                  </div>
                  <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(note);
                      }}
                      className="p-1 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-blue transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id);
                      }}
                      className="p-1 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </button>

                {/* Expanded content */}
                {expandedNoteId === note.id && (
                  <div className="px-3 pb-3 border-t border-xp-border">
                    {editingNoteId === note.id ? (
                      <div className="space-y-2 pt-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-xp-bg border border-xp-border rounded px-3 py-1.5 text-sm text-xp-text focus:outline-none focus:border-xp-blue transition-colors"
                          placeholder="Title"
                        />
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={5}
                          className="w-full bg-xp-bg border border-xp-border rounded px-3 py-1.5 text-sm text-xp-text focus:outline-none focus:border-xp-blue transition-colors resize-y"
                          placeholder="Note content (markdown supported)..."
                        />
                        <div className="flex items-center space-x-2 justify-end">
                          <button
                            onClick={() => setEditingNoteId(null)}
                            className="px-2.5 py-1 text-xs text-xp-text-muted hover:text-xp-text rounded transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdateNote(note.id)}
                            disabled={saving || !editTitle.trim()}
                            className="flex items-center space-x-1 px-2.5 py-1 bg-xp-blue text-white rounded text-xs font-medium hover:bg-opacity-90 disabled:opacity-40 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2">
                        <p className="text-sm text-xp-text whitespace-pre-wrap">
                          {note.content || (
                            <span className="italic text-xp-text-muted">No content</span>
                          )}
                        </p>
                        <p className="text-xs text-xp-text-muted mt-2">
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
            <div className="border border-xp-blue border-opacity-50 rounded-md p-3 space-y-2">
              <input
                ref={titleInputRef}
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowAddForm(false);
                }}
                className="w-full bg-xp-bg border border-xp-border rounded px-3 py-1.5 text-sm text-xp-text placeholder-xp-text-muted focus:outline-none focus:border-xp-blue transition-colors"
                placeholder="Note title..."
                maxLength={100}
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={4}
                className="w-full bg-xp-bg border border-xp-border rounded px-3 py-1.5 text-sm text-xp-text placeholder-xp-text-muted focus:outline-none focus:border-xp-blue transition-colors resize-y"
                placeholder="Note content (markdown supported)..."
              />
              <div className="flex items-center space-x-2 justify-end">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-2.5 py-1 text-xs text-xp-text-muted hover:text-xp-text rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNote}
                  disabled={saving || !newTitle.trim()}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-xp-blue text-white rounded text-xs font-medium hover:bg-opacity-90 disabled:opacity-40 transition-colors"
                >
                  {saving ? (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  <span>Add Note</span>
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-400 bg-opacity-10 border border-red-400 border-opacity-30 rounded px-2 py-1">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-xp-border flex-shrink-0">
          <span className="text-xs text-xp-text-muted">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center space-x-2">
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-xp-blue text-white rounded text-sm font-medium hover:bg-opacity-90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Note</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FileNotesDialog;
