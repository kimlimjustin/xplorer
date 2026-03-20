import React, { useState, useEffect, useRef } from 'react';
import { TauriAPI, type FileAnnotation } from '@/lib/tauri-api';
import { MessageSquare, X, Plus, Trash2, CheckCircle, Circle } from 'lucide-react';

interface FileAnnotationsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
}

const FileAnnotationsDialog = ({
  isOpen,
  onClose,
  filePath,
}: FileAnnotationsDialogProps) => {
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
      <div className="bg-xp-surface border border-xp-border rounded-lg shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-xp-border flex-shrink-0">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-xp-text-muted" />
            <div>
              <h2 className="text-sm font-semibold text-xp-text">Annotations</h2>
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
          ) : annotations.length === 0 ? (
            <p className="text-sm text-xp-text-muted italic">No annotations yet — add one below.</p>
          ) : (
            <>
              {/* Active annotations */}
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

              {/* Resolved annotations */}
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

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-400 bg-opacity-10 border border-red-400 border-opacity-30 rounded px-2 py-1">
              {error}
            </p>
          )}
        </div>

        {/* Add annotation form */}
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
                } else if (e.key === 'Escape') onClose();
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
      </div>
    </div>
  );
}

export default FileAnnotationsDialog;
