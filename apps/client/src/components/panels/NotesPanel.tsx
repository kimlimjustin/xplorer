import React, { useState, useEffect, useCallback } from 'react';
import { TauriAPI, type FileNote, type NoteSearchResult } from '@/lib/tauri-api';
import { StickyNote, X, RefreshCw, Search, FileText } from 'lucide-react';

interface NotesPanelProps {
  onClose?: () => void;
  navigateToPath?: (path: string) => void;
}

interface GroupedNotes {
  path: string;
  fileName: string;
  notes: FileNote[];
  latestUpdate: string;
}

const NotesPanel = ({ onClose, navigateToPath }: NotesPanelProps) => {
  const [grouped, setGrouped] = useState<GroupedNotes[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NoteSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const loadAllNotes = useCallback(async () => {
    setLoading(true);
    try {
      const allNotes = await TauriAPI.getAllNotes();
      const groups: GroupedNotes[] = Object.entries(allNotes)
        .map(([path, notes]) => ({
          path,
          fileName: path.split(/[\\/]/).pop() ?? path,
          notes,
          latestUpdate: notes.reduce(
            (latest, n) => (n.updated_at > latest ? n.updated_at : latest),
            '',
          ),
        }))
        .sort((a, b) => b.latestUpdate.localeCompare(a.latestUpdate));
      setGrouped(groups);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllNotes();
  }, [loadAllNotes]);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const results = await TauriAPI.searchNotes(query);
      setSearchResults(results);
    } catch (err) {
      console.error('Failed to search notes:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleNavigate = (path: string) => {
    if (!navigateToPath) return;
    const separator = path.includes('\\') ? '\\' : '/';
    const parentDir = path.substring(0, path.lastIndexOf(separator));
    if (parentDir) {
      navigateToPath(parentDir);
    }
  };

  return (
    <div className="flex flex-col h-full bg-xp-surface text-xp-text">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-xp-border flex-shrink-0">
        <div className="flex items-center space-x-2">
          <StickyNote className="w-4 h-4 text-xp-text-muted" />
          <span className="text-xs font-semibold text-xp-text uppercase tracking-wider">Notes</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={loadAllNotes}
            disabled={loading}
            className="p-1 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text transition-colors"
            title="Refresh"
            aria-label="Refresh notes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text transition-colors"
              title="Close panel"
              aria-label="Close notes panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-xp-border flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-xp-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            aria-label="Search notes"
            className="w-full bg-xp-bg border border-xp-border rounded pl-7 pr-3 py-1.5 text-sm text-xp-text placeholder:text-xp-text-muted focus:outline-none focus:border-xp-blue transition-colors"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading && grouped.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xp-text-secondary text-sm">
            Loading...
          </div>
        ) : searchResults !== null ? (
          // Search results
          searchResults.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-xp-text-secondary text-sm">
              {searching ? 'Searching...' : 'No matching notes found.'}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {searchResults.map((result, idx) => (
                <li
                  key={`${result.path}:${result.note.id}:${idx}`}
                  className="rounded px-2 py-2 hover:bg-xp-surface-light cursor-pointer transition-colors"
                  onClick={() => handleNavigate(result.path)}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <FileText className="w-3.5 h-3.5 text-xp-text-muted flex-shrink-0" />
                    <span className="text-xs text-xp-text-muted truncate">
                      {result.path.split(/[\\/]/).pop()}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-xp-text truncate">{result.note.title}</p>
                  <p className="text-xs text-xp-text-muted truncate mt-0.5">
                    {result.note.content.substring(0, 80)}
                    {result.note.content.length > 80 ? '...' : ''}
                  </p>
                </li>
              ))}
            </ul>
          )
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-xp-text-secondary">
            <StickyNote className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No notes yet.</p>
            <p className="text-xs mt-1 opacity-60">Right-click a file and choose Notes...</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {grouped.map((group) => (
              <li
                key={group.path}
                className="rounded px-2 py-2 hover:bg-xp-surface-light cursor-pointer transition-colors"
                onClick={() => handleNavigate(group.path)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-xp-text-muted flex-shrink-0" />
                    <span className="text-sm font-medium text-xp-text truncate">
                      {group.fileName}
                    </span>
                  </div>
                  <span className="text-xs text-xp-text-muted flex-shrink-0 ml-2">
                    {group.notes.length} note{group.notes.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {group.notes.length > 0 && (
                  <p className="text-xs text-xp-text-muted truncate mt-1 pl-5">
                    {group.notes[group.notes.length - 1].title}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      {grouped.length > 0 && !searchResults && (
        <div className="px-3 py-1.5 border-t border-xp-border flex-shrink-0">
          <p className="text-xs text-xp-text-muted">
            {grouped.reduce((sum, g) => sum + g.notes.length, 0)} note
            {grouped.reduce((sum, g) => sum + g.notes.length, 0) !== 1 ? 's' : ''} across{' '}
            {grouped.length} file{grouped.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

export default NotesPanel;
