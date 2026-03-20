/**
 * Notes Extension
 *
 * A sidebar panel for managing per-file and global notes.
 * Notes are stored in extension-scoped storage (persisted across sessions).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar, type XplorerAPI } from '@xplorer/extension-sdk';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Note {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

// ── Storage Helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'notes-data';

async function loadNotes(): Promise<Note[]> {
  try {
    const raw = await api.storage.get(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* empty */ }
  return [];
}

async function saveNotes(notes: Note[]): Promise<void> {
  await api.storage.set(STORAGE_KEY, JSON.stringify(notes));
}

// ── Icons (inline SVG) ──────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.5 3H5a2 2 0 00-2 2v14c0 1.1.9 2 2 2h14a2 2 0 002-2V8.5L15.5 3z" />
      <path d="M14 3v6h6" />
    </svg>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────────────

function NotesPanel({ currentPath, selectedFile }: { currentPath: string; selectedFile: { name: string; path: string } | null }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [filter, setFilter] = useState<'all' | 'current'>('all');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load notes on mount
  useEffect(() => {
    loadNotes().then(setNotes);
  }, []);

  // Auto-focus textarea when editing
  useEffect(() => {
    if (editingId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editingId]);

  const addNote = useCallback(async () => {
    const filePath = selectedFile?.path || currentPath || 'General';
    const fileName = selectedFile?.name || currentPath.split(/[/\\]/).filter(Boolean).pop() || 'General';
    const note: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filePath,
      fileName,
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [note, ...notes];
    setNotes(updated);
    await saveNotes(updated);
    setEditingId(note.id);
    setEditContent('');
  }, [notes, selectedFile, currentPath]);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    const updated = notes.map((n) =>
      n.id === editingId ? { ...n, content: editContent, updatedAt: Date.now() } : n,
    );
    // Remove empty notes
    const filtered = updated.filter((n) => n.content.trim() !== '' || n.id === editingId);
    setNotes(filtered);
    await saveNotes(filtered);
    setEditingId(null);
  }, [editingId, editContent, notes]);

  const deleteNote = useCallback(async (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    await saveNotes(updated);
    if (editingId === id) {
      setEditingId(null);
    }
  }, [notes, editingId]);

  const filteredNotes = filter === 'current' && currentPath
    ? notes.filter((n) => n.filePath === currentPath || n.filePath.startsWith(currentPath))
    : notes;

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontSize: 13, color: 'var(--xp-text, #c0caf5)' }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--xp-border, #333)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', border: 'none',
              background: filter === 'all' ? 'var(--xp-blue, #7aa2f7)' : 'var(--xp-surface-light, #1e1e2e)',
              color: filter === 'all' ? '#fff' : 'var(--xp-text-muted, #888)',
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilter('current')}
            style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', border: 'none',
              background: filter === 'current' ? 'var(--xp-blue, #7aa2f7)' : 'var(--xp-surface-light, #1e1e2e)',
              color: filter === 'current' ? '#fff' : 'var(--xp-text-muted, #888)',
            }}
          >
            This Folder
          </button>
        </div>
        <button
          onClick={addNote}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
            background: 'var(--xp-blue, #7aa2f7)', color: '#fff', fontSize: 11,
          }}
        >
          <PlusIcon />
          Add Note
        </button>
      </div>

      {/* Notes list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
        {filteredNotes.length === 0 ? (
          <div style={{
            textAlign: 'center' as const,
            padding: '32px 16px',
            color: 'var(--xp-text-muted, #888)',
          }}>
            <div style={{ marginBottom: 8, fontSize: 24 }}>
              <NoteIcon />
            </div>
            <div style={{ fontSize: 12 }}>No notes yet</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Click "Add Note" to create one
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                style={{
                  background: 'var(--xp-surface-light, #1e1e2e)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  border: editingId === note.id ? '1px solid var(--xp-blue, #7aa2f7)' : '1px solid transparent',
                }}
              >
                {/* Note header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 6, fontSize: 11,
                }}>
                  <span style={{
                    color: 'var(--xp-text-muted, #888)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1,
                  }}>
                    {note.fileName} — {formatTime(note.updatedAt)}
                  </span>
                  <button
                    onClick={() => deleteNote(note.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--xp-text-muted, #888)', padding: 2, marginLeft: 4, flexShrink: 0,
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>

                {/* Note content */}
                {editingId === note.id ? (
                  <textarea
                    ref={textareaRef}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') saveEdit();
                    }}
                    style={{
                      width: '100%', minHeight: 60, resize: 'vertical',
                      background: 'var(--xp-bg, #0a0a1a)', border: 'none', borderRadius: 4,
                      color: 'var(--xp-text, #c0caf5)', fontSize: 12,
                      padding: 8, fontFamily: 'inherit', outline: 'none',
                    }}
                    placeholder="Write your note..."
                  />
                ) : (
                  <div
                    onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                    style={{
                      fontSize: 12, lineHeight: 1.5, cursor: 'text',
                      color: note.content ? 'var(--xp-text, #c0caf5)' : 'var(--xp-text-muted, #888)',
                      whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const,
                    }}
                  >
                    {note.content || 'Click to edit...'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Extension Registration ────────────────────────────────────────────────────

let api: XplorerAPI;

Sidebar.register({
  id: 'notes',
  title: 'Notes',
  description: 'Add and manage notes for files and folders',
  icon: 'sticky-note',
  permissions: ['storage', 'ui:panels'],
  onActivate: (injectedApi) => { api = injectedApi; },
  render: (props) => {
    const currentPath = (props.currentPath as string) || '';
    const selectedFile = props.selectedFile as { name: string; path: string } | null;
    return <NotesPanel currentPath={currentPath} selectedFile={selectedFile} />;
  },
});
