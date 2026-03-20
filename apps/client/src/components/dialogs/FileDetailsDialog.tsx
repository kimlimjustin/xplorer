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
      <div className="bg-xp-surface/95 backdrop-blur-xl border border-xp-border/60 rounded-xl shadow-2xl shadow-black/30 w-full max-w-lg mx-4 flex flex-col overflow-hidden max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-xp-border/40 flex-shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-1.5 rounded-md bg-xp-blue/10">
              <FileText className="w-4 h-4 text-xp-blue" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-xp-text">File Details</h2>
              <p className="text-xs text-xp-text-muted truncate max-w-[280px]" title={filePath}>
                {fileName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/5 text-xp-text-muted hover:text-xp-text transition-colors"
          >
            <X className="w-4 h-4" />
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
}

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
      icon: <StickyNote className="w-3.5 h-3.5" />,
      count: counts.notes,
    },
    {
      id: 'annotations',
      label: 'Annotations',
      icon: <MessageSquare className="w-3.5 h-3.5" />,
      count: counts.annotations,
    },
    {
      id: 'metadata',
      label: 'Metadata',
      icon: <Database className="w-3.5 h-3.5" />,
      count: counts.metadata,
    },
  ];

  return (
    <div className="flex px-2 pt-1 border-b border-xp-border/40 flex-shrink-0 bg-white/[0.02]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all relative rounded-t-md ${
            activeTab === tab.id
              ? 'text-xp-blue bg-xp-blue/[0.08]'
              : 'text-xp-text-muted hover:text-xp-text hover:bg-white/[0.03]'
          }`}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.count > 0 && (
            <span
              className={`text-[10px] leading-none px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === tab.id
                  ? 'bg-xp-blue/20 text-xp-blue'
                  : 'bg-white/5 text-xp-text-muted'
              }`}
            >
              {tab.count}
            </span>
          )}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-xp-blue rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}

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
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <p className="text-sm text-xp-text-muted">Loading...</p>
        ) : notes.length === 0 && !showAddForm ? (
          <p className="text-sm text-xp-text-muted italic">No notes yet — add one below.</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="border border-xp-border rounded-md overflow-hidden">
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
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-xp-blue text-white rounded text-sm font-medium hover:bg-opacity-90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Note</span>
          </button>
        )}
      </div>
    </>
  );
}

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
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <p className="text-sm text-xp-text-muted">Loading...</p>
        ) : annotations.length === 0 ? (
          <p className="text-sm text-xp-text-muted italic">No annotations yet — add one below.</p>
        ) : (
          <>
            {activeAnnotations.length > 0 && (
              <div className="space-y-1.5">
                {activeAnnotations.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start space-x-2 rounded px-2 py-2 hover:bg-xp-surface-light group transition-colors"
                  >
                    <button
                      onClick={() => handleToggleResolved(a.id)}
                      className="mt-0.5 flex-shrink-0 text-xp-text-muted hover:text-green-400 transition-colors"
                      title="Mark as resolved"
                    >
                      <Circle className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-xp-text">{a.text}</p>
                      <p className="text-xs text-xp-text-muted mt-0.5">
                        {a.author} &middot; {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-xp-surface-light text-xp-text-muted hover:text-red-400 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {resolvedAnnotations.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-xp-text-muted uppercase tracking-wide pt-1">
                  Resolved ({resolvedAnnotations.length})
                </p>
                {resolvedAnnotations.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start space-x-2 rounded px-2 py-2 hover:bg-xp-surface-light group transition-colors opacity-60"
                  >
                    <button
                      onClick={() => handleToggleResolved(a.id)}
                      className="mt-0.5 flex-shrink-0 text-green-400 hover:text-xp-text-muted transition-colors"
                      title="Unresolve"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-xp-text line-through">{a.text}</p>
                      <p className="text-xs text-xp-text-muted mt-0.5">
                        {a.author} &middot; {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-xp-surface-light text-xp-text-muted hover:text-red-400 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-400 bg-opacity-10 border border-red-400 border-opacity-30 rounded px-2 py-1">
            {error}
          </p>
        )}
      </div>

      {/* Add annotation form in footer */}
      <div className="px-4 py-3 border-t border-xp-border flex-shrink-0">
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
            className="flex-1 bg-xp-bg border border-xp-border rounded px-3 py-1.5 text-sm text-xp-text placeholder-xp-text-muted focus:outline-none focus:border-xp-blue transition-colors"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newText.trim()}
            className="flex items-center space-x-1 px-2.5 py-1.5 bg-xp-blue text-white rounded text-sm font-medium hover:bg-opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>Add</span>
          </button>
        </div>
      </div>
    </>
  );
}

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
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? (
          <p className="text-sm text-xp-text-muted">Loading...</p>
        ) : fields.length === 0 ? (
          <p className="text-sm text-xp-text-muted italic">
            No metadata fields — click Add Field below.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_1fr_90px_28px] gap-2 px-1">
              <span className="text-xs font-medium text-xp-text-muted uppercase tracking-wide">
                Key
              </span>
              <span className="text-xs font-medium text-xp-text-muted uppercase tracking-wide">
                Value
              </span>
              <span className="text-xs font-medium text-xp-text-muted uppercase tracking-wide">
                Type
              </span>
              <span />
            </div>

            {fields.map((field) => (
              <div
                key={field._localId}
                className="grid grid-cols-[1fr_1fr_90px_28px] gap-2 items-start"
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
                    className="w-full bg-xp-bg border border-xp-border rounded px-2 py-1.5 text-sm text-xp-text focus:outline-none focus:border-xp-blue transition-colors"
                    placeholder="Key"
                    maxLength={50}
                  />
                  {showKeySuggestions === field._localId &&
                    (() => {
                      const suggestions = getFilteredSuggestions(field.key);
                      if (suggestions.length === 0) return null;
                      return (
                        <div className="absolute z-10 top-full left-0 right-0 mt-0.5 bg-xp-popover border border-xp-border rounded shadow-xl backdrop-blur-xl max-h-32 overflow-y-auto">
                          {suggestions.map((key) => (
                            <button
                              key={key}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleFieldChange(field._localId, 'key', key);
                                setShowKeySuggestions(null);
                              }}
                              className="w-full text-left px-2 py-1 text-sm text-xp-text hover:bg-xp-surface-light transition-colors"
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
                      field.field_type === 'number'
                        ? 'number'
                        : field.field_type === 'date'
                          ? 'date'
                          : 'text'
                    }
                    value={field.value}
                    onChange={(e) => handleFieldChange(field._localId, 'value', e.target.value)}
                    className="w-full bg-xp-bg border border-xp-border rounded px-2 py-1.5 text-sm text-xp-text focus:outline-none focus:border-xp-blue transition-colors"
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
                  className="p-1.5 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-red-400 transition-colors"
                  title="Remove field"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </>
        )}

        <button
          onClick={handleAddField}
          className="flex items-center space-x-1.5 px-2 py-1.5 text-sm text-xp-blue hover:bg-xp-surface-light rounded transition-colors w-full justify-center border border-dashed border-xp-border"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Field</span>
        </button>

        {error && (
          <p className="text-xs text-red-400 bg-red-400 bg-opacity-10 border border-red-400 border-opacity-30 rounded px-2 py-1">
            {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end space-x-2 px-4 py-3 border-t border-xp-border flex-shrink-0">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light rounded transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || loading || !dirty}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-xp-blue text-white rounded text-sm font-medium hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Save</span>
            </>
          )}
        </button>
      </div>
    </>
  );
}

export default FileDetailsDialog;
