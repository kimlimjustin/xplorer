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

const NotesSearchResults = ({
  searchResults,
  searching,
  handleNavigate,
}: {
  searchResults: NoteSearchResult[];
  searching: boolean;
  handleNavigate: (path: string) => void;
}) => {
  if (searchResults.length === 0) {
    return (
      <div className="text-xp-text-secondary flex items-center justify-center py-8 text-sm">
        {searching ? 'Searching...' : 'No matching notes found.'}
      </div>
    );
  }

  return (
    <ul className="space-y-1.5">
      {searchResults.map((result) => (
        <li
          key={`${result.path}:${result.note.id}`}
          className="hover:bg-xp-surface-light cursor-pointer rounded px-2 py-2 transition-colors"
          onClick={() => handleNavigate(result.path)}
        >
          <div className="mb-1 flex items-center space-x-2">
            <FileText className="text-xp-text-muted h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-xp-text-muted truncate text-xs">
              {result.path.split(/[\\/]/).pop()}
            </span>
          </div>
          <p className="text-xp-text truncate text-sm font-medium">{result.note.title}</p>
          <p className="text-xp-text-muted mt-0.5 truncate text-xs">
            {result.note.content.substring(0, 80)}
            {result.note.content.length > 80 ? '...' : ''}
          </p>
        </li>
      ))}
    </ul>
  );
};

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
    <div className="bg-xp-surface text-xp-text flex h-full flex-col">
      {/* Header */}
      <div className="border-xp-border flex flex-shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="flex items-center space-x-2">
          <StickyNote className="text-xp-text-muted h-4 w-4" />
          <span className="text-xp-text text-xs font-semibold uppercase tracking-wider">Notes</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={loadAllNotes}
            disabled={loading}
            className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text rounded p-1 transition-colors"
            title="Refresh"
            aria-label="Refresh notes"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text rounded p-1 transition-colors"
              title="Close panel"
              aria-label="Close notes panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="border-xp-border flex-shrink-0 border-b px-3 py-2">
        <div className="relative">
          <Search className="text-xp-text-muted absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            aria-label="Search notes"
            className="bg-xp-bg border-xp-border text-xp-text placeholder:text-xp-text-muted focus:border-xp-blue w-full rounded border py-1.5 pl-7 pr-3 text-sm transition-colors focus:outline-none"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading && grouped.length === 0 ? (
          <div className="text-xp-text-secondary flex items-center justify-center py-8 text-sm">
            Loading...
          </div>
        ) : null}
        {!(loading && grouped.length === 0) && searchResults !== null ? (
          <NotesSearchResults
            searchResults={searchResults}
            searching={searching}
            handleNavigate={handleNavigate}
          />
        ) : null}
        {!(loading && grouped.length === 0) && searchResults === null && grouped.length === 0 ? (
          <div className="text-xp-text-secondary flex flex-col items-center justify-center py-8">
            <StickyNote className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm">No notes yet.</p>
            <p className="mt-1 text-xs opacity-60">Right-click a file and choose Notes...</p>
          </div>
        ) : null}
        {!(loading && grouped.length === 0) && searchResults === null && grouped.length > 0 && (
          <ul className="space-y-1.5">
            {grouped.map((group) => (
              <li
                key={group.path}
                className="hover:bg-xp-surface-light cursor-pointer rounded px-2 py-2 transition-colors"
                onClick={() => handleNavigate(group.path)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center space-x-2">
                    <FileText className="text-xp-text-muted h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-xp-text truncate text-sm font-medium">
                      {group.fileName}
                    </span>
                  </div>
                  <span className="text-xp-text-muted ml-2 flex-shrink-0 text-xs">
                    {group.notes.length} note{group.notes.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {group.notes.length > 0 && (
                  <p className="text-xp-text-muted mt-1 truncate pl-5 text-xs">
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
        <div className="border-xp-border flex-shrink-0 border-t px-3 py-1.5">
          <p className="text-xp-text-muted text-xs">
            {grouped.reduce((sum, g) => sum + g.notes.length, 0)} note
            {grouped.reduce((sum, g) => sum + g.notes.length, 0) !== 1 ? 's' : ''} across{' '}
            {grouped.length} file{grouped.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
};

export default NotesPanel;
