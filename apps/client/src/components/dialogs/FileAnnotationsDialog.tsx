import React, { useState, useEffect, useRef } from 'react';
import { TauriAPI, type FileAnnotation } from '@/lib/tauri-api';
import { MessageSquare, X, Plus, Trash2, CheckCircle, Circle } from 'lucide-react';

interface FileAnnotationsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
}

const FileAnnotationsDialog = ({ isOpen, onClose, filePath }: FileAnnotationsDialogProps) => {
  const [annotations, setAnnotations] = useState<FileAnnotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || !filePath) return;
    setError(null);
    setNewText('');

    setLoading(true);
    TauriAPI.getFileAnnotations(filePath)
      .then(setAnnotations)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [isOpen, filePath]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
  const activeAnnotations = annotations.filter((a) => !a.resolved);
  const resolvedAnnotations = annotations.filter((a) => a.resolved);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-xp-surface border-xp-border mx-4 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-lg border shadow-2xl">
        {/* Header */}
        <div className="border-xp-border flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="flex items-center space-x-2">
            <MessageSquare className="text-xp-text-muted h-4 w-4" />
            <div>
              <h2 className="text-xp-text text-sm font-semibold">Annotations</h2>
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
          ) : annotations.length === 0 ? (
            <p className="text-xp-text-muted text-sm italic">No annotations yet — add one below.</p>
          ) : (
            <>
              {/* Active annotations */}
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

              {/* Resolved annotations */}
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
          )}

          {/* Error */}
          {error && (
            <p className="rounded border border-red-400 border-opacity-30 bg-red-400 bg-opacity-10 px-2 py-1 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Add annotation form */}
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
                } else if (e.key === 'Escape') onClose();
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
      </div>
    </div>
  );
};

export default FileAnnotationsDialog;
