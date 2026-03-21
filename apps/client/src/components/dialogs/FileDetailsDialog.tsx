import React, { useState, useEffect, useRef } from 'react';
import {
  TauriAPI,
  type FileNote,
  type FileAnnotation,
  type CustomMetadataField,
} from '@/lib/tauri-api';
import {
  FileText,
  X,
  Plus,
  Check,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  StickyNote,
  MessageSquare,
  Database,
  Circle,
  CheckCircle,
} from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

export type FileDetailsTab = 'notes' | 'annotations' | 'metadata';

interface FileDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  initialTab?: FileDetailsTab;
}

const FileDetailsDialog = ({
  isOpen,
  onClose,
  filePath,
  initialTab = 'notes',
}: FileDetailsDialogProps) => {
  const [activeTab, setActiveTab] = useState<FileDetailsTab>(initialTab);

  // Reset tab when dialog opens with a new initialTab
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-xp-surface/95 border-xp-border/60 mx-4 flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-2xl shadow-black/30 backdrop-blur-xl duration-150 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="border-xp-border/40 flex flex-shrink-0 items-center justify-between border-b px-5 py-3.5">
          <div className="flex min-w-0 items-center space-x-2.5">
            <div className="bg-xp-blue/10 rounded-md p-1.5">
              <FileText className="text-xp-blue h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xp-text text-sm font-semibold">File Details</h2>
              <p className="text-xp-text-muted max-w-[280px] truncate text-xs" title={filePath}>
                {fileName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-xp-text-muted hover:text-xp-text rounded-md p-1.5 transition-colors hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab bar */}
        <TabBar activeTab={activeTab} setActiveTab={setActiveTab} filePath={filePath} />

        {/* Tab content */}
        {activeTab === 'notes' && <NotesTab filePath={filePath} />}
        {activeTab === 'annotations' && <AnnotationsTab filePath={filePath} />}
        {activeTab === 'metadata' && <MetadataTab filePath={filePath} onClose={onClose} />}
      </div>
    </div>
  );
};

// ── Tab Bar ─────────────────────────────────────────────────────────────────

const TabBar = ({
  activeTab,
  setActiveTab,
  filePath,
}: {
  activeTab: FileDetailsTab;
  setActiveTab: (tab: FileDetailsTab) => void;
  filePath: string;
}) => {
  const [counts, setCounts] = useState({ notes: 0, annotations: 0, metadata: 0 });

  useEffect(() => {
    if (!filePath) return;
    Promise.all([
      TauriAPI.getFileNotes(filePath)
        .then((n) => n.length)
        .catch(() => 0),
      TauriAPI.getFileAnnotations(filePath)
        .then((a) => a.length)
        .catch(() => 0),
      TauriAPI.getFileMetadata(filePath)
        .then((m) => m.length)
        .catch(() => 0),
    ]).then(([notes, annotations, metadata]) => setCounts({ notes, annotations, metadata }));
  }, [filePath]);

  const tabs: { id: FileDetailsTab; label: string; icon: React.ReactNode; count: number }[] = [
    {
      id: 'notes',
      label: 'Notes',
      icon: <StickyNote className="h-3.5 w-3.5" />,
      count: counts.notes,
    },
    {
      id: 'annotations',
      label: 'Annotations',
      icon: <MessageSquare className="h-3.5 w-3.5" />,
      count: counts.annotations,
    },
    {
      id: 'metadata',
      label: 'Metadata',
      icon: <Database className="h-3.5 w-3.5" />,
      count: counts.metadata,
    },
  ];

  return (
    <div className="border-xp-border/40 flex flex-shrink-0 border-b bg-white/[0.02] px-2 pt-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`relative flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-medium transition-all ${
            activeTab === tab.id
              ? 'text-xp-blue bg-xp-blue/[0.08]'
              : 'text-xp-text-muted hover:text-xp-text hover:bg-white/[0.03]'
          }`}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.count > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                activeTab === tab.id
                  ? 'bg-xp-blue/20 text-xp-blue'
                  : 'text-xp-text-muted bg-white/5'
              }`}
            >
              {tab.count}
            </span>
          )}
          {activeTab === tab.id && (
            <div className="bg-xp-blue absolute bottom-0 left-2 right-2 h-[2px] rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
};

// ── Notes Tab ───────────────────────────────────────────────────────────────

const NotesTab = ({ filePath }: { filePath: string }) => {
  const [notes, setNotes] = useState<FileNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!filePath) return;
    setError(null);
    setShowAddForm(false);
    setEditingNoteId(null);
    setExpandedNoteId(null);
    setLoading(true);
    TauriAPI.getFileNotes(filePath)
      .then(setNotes)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [filePath]);

  useEffect(() => {
    if (showAddForm) setTimeout(() => titleInputRef.current?.focus(), 50);
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

  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {/* eslint-disable-next-line no-nested-ternary */}
        {loading ? (
          <p className="text-xp-text-muted text-sm">Loading...</p>
        ) : notes.length === 0 && !showAddForm ? (
          <p className="text-xp-text-muted text-sm italic">No notes yet — add one below.</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="border-xp-border overflow-hidden rounded-md border">
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
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-xp-blue flex items-center space-x-1.5 rounded px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Note</span>
          </button>
        )}
      </div>
    </>
  );
};

// ── Annotations Tab ─────────────────────────────────────────────────────────

const AnnotationsTab = ({ filePath }: { filePath: string }) => {
  const [annotations, setAnnotations] = useState<FileAnnotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!filePath) return;
    setError(null);
    setNewText('');
    setLoading(true);
    TauriAPI.getFileAnnotations(filePath)
      .then(setAnnotations)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [filePath]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;
    setSaving(true);
    setError(null);
    try {
      const annotation = await TauriAPI.addFileAnnotation(filePath, text);
      setAnnotations((prev) => [...prev, annotation]);
      setNewText('');
      inputRef.current?.focus();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleResolved = async (annotationId: string) => {
    setError(null);
    try {
      await TauriAPI.toggleAnnotationResolved(filePath, annotationId);
      setAnnotations((prev) =>
        prev.map((a) => (a.id === annotationId ? { ...a, resolved: !a.resolved } : a)),
      );
    } catch (err) {
      setError(String(err));
    }
  };

  const handleDelete = async (annotationId: string) => {
    setError(null);
    try {
      await TauriAPI.deleteFileAnnotation(filePath, annotationId);
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
    } catch (err) {
      setError(String(err));
    }
  };

  const activeAnnotations = annotations.filter((a) => !a.resolved);
  const resolvedAnnotations = annotations.filter((a) => a.resolved);

  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {(() => {
          if (loading) return <p className="text-xp-text-muted text-sm">Loading...</p>;
          if (annotations.length === 0)
            {return (
              <p className="text-xp-text-muted text-sm italic">
                No annotations yet — add one below.
              </p>
            );}
          return (
            <>
              {activeAnnotations.length > 0 && (
                <div className="space-y-1.5">
                  {activeAnnotations.map((a) => (
                    <div
                      key={a.id}
                      className="hover:bg-xp-surface-light group flex items-start space-x-2 rounded px-2 py-2 transition-colors"
                    >
                      <button
                        onClick={() => handleToggleResolved(a.id)}
                        className="text-xp-text-muted mt-0.5 flex-shrink-0 transition-colors hover:text-green-400"
                        title="Mark as resolved"
                      >
                        <Circle className="h-4 w-4" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-xp-text text-sm">{a.text}</p>
                        <p className="text-xp-text-muted mt-0.5 text-xs">
                          {a.author} &middot; {new Date(a.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="hover:bg-xp-surface-light text-xp-text-muted flex-shrink-0 rounded p-1 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {resolvedAnnotations.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xp-text-muted pt-1 text-xs font-medium uppercase tracking-wide">
                    Resolved ({resolvedAnnotations.length})
                  </p>
                  {resolvedAnnotations.map((a) => (
                    <div
                      key={a.id}
                      className="hover:bg-xp-surface-light group flex items-start space-x-2 rounded px-2 py-2 opacity-60 transition-colors"
                    >
                      <button
                        onClick={() => handleToggleResolved(a.id)}
                        className="hover:text-xp-text-muted mt-0.5 flex-shrink-0 text-green-400 transition-colors"
                        title="Unresolve"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-xp-text text-sm line-through">{a.text}</p>
                        <p className="text-xp-text-muted mt-0.5 text-xs">
                          {a.author} &middot; {new Date(a.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="hover:bg-xp-surface-light text-xp-text-muted flex-shrink-0 rounded p-1 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}

        {error && (
          <p className="rounded border border-red-400 border-opacity-30 bg-red-400 bg-opacity-10 px-2 py-1 text-xs text-red-400">
            {error}
          </p>
        )}
      </div>

      {/* Add annotation form in footer */}
      <div className="border-xp-border flex-shrink-0 border-t px-4 py-3">
        <div className="flex items-center space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={newText}
            onChange={(e) => {
              setNewText(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Add an annotation..."
            maxLength={500}
            className="bg-xp-bg border-xp-border text-xp-text placeholder-xp-text-muted focus:border-xp-blue flex-1 rounded border px-3 py-1.5 text-sm transition-colors focus:outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newText.trim()}
            className="bg-xp-blue flex items-center space-x-1 rounded px-2.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span>Add</span>
          </button>
        </div>
      </div>
    </>
  );
};

// ── Metadata Tab ────────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
  { value: 'boolean', label: 'Boolean' },
];

interface EditableField extends CustomMetadataField {
  _localId: number;
}

let nextLocalId = 0;

const MetadataTab = ({ filePath, onClose }: { filePath: string; onClose: () => void }) => {
  const [fields, setFields] = useState<EditableField[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allKeys, setAllKeys] = useState<string[]>([]);
  const [showKeySuggestions, setShowKeySuggestions] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const keyInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  useEffect(() => {
    if (!filePath) return;
    setError(null);
    setDirty(false);
    setLoading(true);
    Promise.all([TauriAPI.getFileMetadata(filePath), TauriAPI.getAllMetadataKeys()])
      .then(([existingFields, keys]) => {
        setFields(existingFields.map((f) => ({ ...f, _localId: nextLocalId++ })));
        setAllKeys(keys);
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [filePath]);

  const handleAddField = () => {
    const id = nextLocalId++;
    setFields((prev) => [...prev, { key: '', value: '', field_type: 'text', _localId: id }]);
    setDirty(true);
    setTimeout(() => keyInputRefs.current.get(id)?.focus(), 50);
  };

  const handleRemoveField = (localId: number) => {
    setFields((prev) => prev.filter((f) => f._localId !== localId));
    setDirty(true);
  };

  const handleFieldChange = (localId: number, key: keyof CustomMetadataField, value: string) => {
    setFields((prev) => prev.map((f) => (f._localId === localId ? { ...f, [key]: value } : f)));
    setDirty(true);
  };

  const handleSave = async () => {
    const validFields = fields.filter((f) => f.key.trim());
    const duplicateKeys = validFields.filter(
      (f, i, arr) => arr.findIndex((a) => a.key === f.key) !== i,
    );
    if (duplicateKeys.length > 0) {
      setError(`Duplicate key: "${duplicateKeys[0].key}"`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const toSave: CustomMetadataField[] = validFields.map(({ key, value, field_type }) => ({
        key: key.trim(),
        value,
        field_type,
      }));
      await TauriAPI.setFileMetadata(filePath, toSave);
      setDirty(false);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const getFilteredSuggestions = (currentValue: string) => {
    if (!currentValue.trim()) return allKeys;
    const lower = currentValue.toLowerCase();
    return allKeys.filter((k) => k.toLowerCase().includes(lower) && k.toLowerCase() !== lower);
  };

  return (
    <>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {(() => {
          if (loading) return <p className="text-xp-text-muted text-sm">Loading...</p>;
          if (fields.length === 0) {
            return (
              <p className="text-xp-text-muted text-sm italic">
                No metadata fields — click Add Field below.
              </p>
            );
          }
          return (
            <>
              <div className="grid grid-cols-[1fr_1fr_90px_28px] gap-2 px-1">
                <span className="text-xp-text-muted text-xs font-medium uppercase tracking-wide">
                  Key
                </span>
                <span className="text-xp-text-muted text-xs font-medium uppercase tracking-wide">
                  Value
                </span>
                <span className="text-xp-text-muted text-xs font-medium uppercase tracking-wide">
                  Type
                </span>
                <span />
              </div>

              {fields.map((field) => (
                <div
                  key={field._localId}
                  className="grid grid-cols-[1fr_1fr_90px_28px] items-start gap-2"
                >
                  <div className="relative">
                    <input
                      ref={(el) => {
                        if (el) keyInputRefs.current.set(field._localId, el);
                        else keyInputRefs.current.delete(field._localId);
                      }}
                      type="text"
                      value={field.key}
                      onChange={(e) => handleFieldChange(field._localId, 'key', e.target.value)}
                      onFocus={() => setShowKeySuggestions(field._localId)}
                      onBlur={() => setTimeout(() => setShowKeySuggestions(null), 150)}
                      className="bg-xp-bg border-xp-border text-xp-text focus:border-xp-blue w-full rounded border px-2 py-1.5 text-sm transition-colors focus:outline-none"
                      placeholder="Key"
                      maxLength={50}
                    />
                    {showKeySuggestions === field._localId &&
                      (() => {
                        const suggestions = getFilteredSuggestions(field.key);
                        if (suggestions.length === 0) return null;
                        return (
                          <div className="bg-xp-popover border-xp-border absolute left-0 right-0 top-full z-10 mt-0.5 max-h-32 overflow-y-auto rounded border shadow-xl backdrop-blur-xl">
                            {suggestions.map((key) => (
                              <button
                                key={key}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleFieldChange(field._localId, 'key', key);
                                  setShowKeySuggestions(null);
                                }}
                                className="text-xp-text hover:bg-xp-surface-light w-full px-2 py-1 text-left text-sm transition-colors"
                              >
                                {key}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                  </div>

                  {field.field_type === 'boolean' ? (
                    <Select
                      value={field.value || undefined}
                      onValueChange={(v) => handleFieldChange(field._localId, 'value', v)}
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <input
                      type={
                        // eslint-disable-next-line no-nested-ternary
                        field.field_type === 'number'
                          ? 'number'
                          : field.field_type === 'date'
                            ? 'date'
                            : 'text'
                      }
                      value={field.value}
                      onChange={(e) => handleFieldChange(field._localId, 'value', e.target.value)}
                      className="bg-xp-bg border-xp-border text-xp-text focus:border-xp-blue w-full rounded border px-2 py-1.5 text-sm transition-colors focus:outline-none"
                      placeholder="Value"
                    />
                  )}

                  <Select
                    value={field.field_type}
                    onValueChange={(v) => handleFieldChange(field._localId, 'field_type', v)}
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <button
                    onClick={() => handleRemoveField(field._localId)}
                    className="hover:bg-xp-surface-light text-xp-text-muted rounded p-1.5 transition-colors hover:text-red-400"
                    title="Remove field"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </>
          );
        })()}

        <button
          onClick={handleAddField}
          className="text-xp-blue hover:bg-xp-surface-light border-xp-border flex w-full items-center justify-center space-x-1.5 rounded border border-dashed px-2 py-1.5 text-sm transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Field</span>
        </button>

        {error && (
          <p className="rounded border border-red-400 border-opacity-30 bg-red-400 bg-opacity-10 px-2 py-1 text-xs text-red-400">
            {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="border-xp-border flex flex-shrink-0 items-center justify-end space-x-2 border-t px-4 py-3">
        <button
          onClick={onClose}
          className="text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light rounded px-3 py-1.5 text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || loading || !dirty}
          className="bg-xp-blue flex items-center space-x-1.5 rounded px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Save</span>
            </>
          )}
        </button>
      </div>
    </>
  );
};

export default FileDetailsDialog;
