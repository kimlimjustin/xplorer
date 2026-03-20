import React, { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TauriAPI, SearchResult, RecentFile } from '@/lib/tauri-api';
import { File, Folder } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  loadHistory,
  addToHistory,
  loadFavorites,
  saveFavorites,
  formatTimestamp,
  fuzzyMatch,
  fuzzyScore,
  HighlightedText,
  StarIcon,
  ClockIcon,
  highlightStyle,
  sectionHeaderStyle,
  itemBaseStyle,
  itemSelectedStyle,
  iconWrapStyle,
  shortcutStyle,
  timestampStyle,
  starBtnBaseStyle,
  kbdStyle,
  textEllipsisStyle,
  fileNameContainerStyle,
  fileNameStyle,
  filePathStyle,
  backdropStyle,
  dialogStyle,
  searchBarStyle,
  searchIconStyle,
  inputStyle,
  clearBtnStyle,
  clearIconStyle,
  emptyStateStyle,
  loadingContainerStyle,
  loadingSpinnerStyle,
  footerStyle,
  COMMAND_ROW_HEIGHT,
  FILE_ROW_HEIGHT,
  SECTION_HEADER_HEIGHT,
  LOADING_ROW_HEIGHT,
} from './command-palette-helpers';
import type {
  Command,
  CommandPaletteProps,
  HistoryEntry,
  PaletteItem,
  VirtualRow,
} from './command-palette-helpers';

export type { Command } from './command-palette-helpers';

// ── Main Component ──────────────────────────────────────────────────────────

const CommandPaletteInner = ({
  isOpen,
  onClose,
  commands,
  onFileSelect,
  currentPath,
}: CommandPaletteProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fileResults, setFileResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deferred query for filtering - input stays responsive while filtering catches up
  const deferredQuery = useDeferredValue(query);

  // Command mode: ">" prefix means search commands only (like VS Code)
  const isCommandMode = deferredQuery.startsWith('>');
  const effectiveQuery = isCommandMode ? deferredQuery.slice(1).trim() : deferredQuery.trim();

  // Load history, favorites, and recent files when palette opens
  useEffect(() => {
    if (isOpen) {
      setFavorites(loadFavorites());
      setHistory(loadHistory());
      setQuery('');
      setSelectedIndex(0);
      setFileResults([]);
      // Fetch recent files from backend
      TauriAPI.getRecentFiles(10)
        .then((files) => {
          setRecentFiles(files);
        })
        .catch(() => {
          setRecentFiles([]);
        });
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const toggleFavorite = useCallback((commandId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setFavorites((prev) => {
      const newFavs = prev.includes(commandId)
        ? prev.filter((id) => id !== commandId)
        : [...prev, commandId];
      saveFavorites(newFavs);
      return newFavs;
    });
  }, []);

  // Build command lookup map
  const commandMap = useMemo(() => {
    const map = new Map<string, Command>();
    for (const cmd of commands) map.set(cmd.id, cmd);
    return map;
  }, [commands]);

  // Filter and rank commands by fuzzy match (uses deferred query to avoid blocking input)
  const filteredCommands = useMemo(() => {
    if (!effectiveQuery) {
      return commands.map((cmd) => ({ command: cmd, matchIndices: [] as number[], score: 0 }));
    }

    const results: { command: Command; matchIndices: number[]; score: number }[] = [];

    for (const cmd of commands) {
      // Match against title
      const titleMatch = fuzzyMatch(effectiveQuery, cmd.title);
      if (titleMatch) {
        results.push({
          command: cmd,
          matchIndices: titleMatch,
          score:
            fuzzyScore(effectiveQuery, cmd.title, titleMatch) + (favoriteSet.has(cmd.id) ? -100 : 0),
        });
        continue;
      }

      // Match against category + title
      if (cmd.category) {
        const combined = `${cmd.category}: ${cmd.title}`;
        const combinedMatch = fuzzyMatch(effectiveQuery, combined);
        if (combinedMatch) {
          results.push({
            command: cmd,
            matchIndices: [],
            score:
              fuzzyScore(effectiveQuery, combined, combinedMatch) +
              5 +
              (favoriteSet.has(cmd.id) ? -100 : 0),
          });
        }
      }
    }

    results.sort((a, b) => a.score - b.score);
    return results;
  }, [commands, effectiveQuery, favoriteSet]);

  // Build the flat item list for keyboard navigation
  const paletteItems = useMemo((): PaletteItem[] => {
    const items: PaletteItem[] = [];
    const isEmptyQuery = !effectiveQuery;

    if (isEmptyQuery && !isCommandMode) {
      // Favorites section
      const favCommands = favorites
        .map((id) => commandMap.get(id))
        .filter((cmd): cmd is Command => cmd !== undefined);
      if (favCommands.length > 0) {
        favCommands.forEach((cmd, i) => {
          items.push({
            type: 'command',
            command: cmd,
            matchIndices: [],
            sectionLabel: i === 0 ? t('commandPalette.favorites') : undefined,
          });
        });
      }

      // Recent Commands section
      const recentCommands = history
        .map((entry) => {
          const cmd = commandMap.get(entry.commandId);
          if (!cmd) return null;
          // Skip if already in favorites
          if (favoriteSet.has(entry.commandId)) return null;
          return { cmd, timestamp: entry.timestamp };
        })
        .filter((x): x is { cmd: Command; timestamp: number } => x !== null);

      if (recentCommands.length > 0) {
        recentCommands.forEach((entry, i) => {
          items.push({
            type: 'command',
            command: entry.cmd,
            matchIndices: [],
            sectionLabel: i === 0 ? t('commandPalette.recentCommands') : undefined,
          });
        });
      }

      // Recent Files section
      if (recentFiles.length > 0) {
        recentFiles.forEach((file, i) => {
          items.push({
            type: 'recent-file',
            file,
            sectionLabel: i === 0 ? t('commandPalette.recentFiles') : undefined,
          });
        });
      }

      // All Commands section (grouped by category)
      const allCommands = filteredCommands.filter(
        (item) =>
          !favoriteSet.has(item.command.id) &&
          !history.some((h) => h.commandId === item.command.id),
      );
      let lastCategory = '';
      allCommands.forEach((item, i) => {
        const cat = item.command.category || '';
        const newCat = cat !== lastCategory;
        if (newCat) lastCategory = cat;
        items.push({
          type: 'command',
          command: item.command,
          matchIndices: item.matchIndices,
          sectionLabel: i === 0 && !cat ? t('commandPalette.allCommands') : newCat ? cat : undefined,
        });
      });
    } else if (isCommandMode && isEmptyQuery) {
      // ">" with no query: show all commands
      commands.forEach((cmd, i) => {
        items.push({
          type: 'command',
          command: cmd,
          matchIndices: [],
          sectionLabel: i === 0 ? t('commandPalette.commands') : undefined,
        });
      });
    } else {
      // Query is typed: show filtered commands with section header
      filteredCommands.forEach((item, i) => {
        items.push({
          type: 'command',
          command: item.command,
          matchIndices: item.matchIndices,
          sectionLabel: i === 0 ? t('commandPalette.commands') : undefined,
        });
      });
    }

    return items;
  }, [effectiveQuery, isCommandMode, commands, favorites, history, recentFiles, filteredCommands, commandMap, favoriteSet, t]);

  // History timestamps lookup for display
  const historyTimestamps = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of history) {
      map.set(entry.commandId, entry.timestamp);
    }
    return map;
  }, [history]);

  // Show file results only when query is typed, not in command mode, and there are results
  const showFileResults = !isCommandMode && effectiveQuery.length >= 2 && fileResults.length > 0;
  const totalItems = paletteItems.length + (showFileResults ? fileResults.length : 0);

  // Build flat virtual rows for the virtualizer
  const virtualRows = useMemo((): VirtualRow[] => {
    const rows: VirtualRow[] = [];
    let itemIndex = 0;

    for (const item of paletteItems) {
      if (item.sectionLabel) {
        rows.push({ kind: 'section-header', label: item.sectionLabel });
      }
      if (item.type === 'command') {
        rows.push({
          kind: 'command',
          command: item.command,
          matchIndices: item.matchIndices,
          itemIndex,
        });
      } else {
        rows.push({ kind: 'recent-file', file: item.file, itemIndex });
      }
      itemIndex++;
    }

    if (showFileResults) {
      rows.push({ kind: 'section-header', label: t('commandPalette.filesAndFolders') });
      for (const result of fileResults) {
        rows.push({ kind: 'search-file', result, itemIndex });
        itemIndex++;
      }
    }

    if (isSearching) {
      rows.push({ kind: 'loading' });
    }

    return rows;
  }, [paletteItems, showFileResults, fileResults, isSearching, t]);

  // Estimate row height for virtualizer
  const estimateSize = useCallback(
    (index: number) => {
      const row = virtualRows[index];
      if (!row) return COMMAND_ROW_HEIGHT;
      switch (row.kind) {
        case 'section-header':
          return SECTION_HEADER_HEIGHT;
        case 'command':
          return COMMAND_ROW_HEIGHT;
        case 'recent-file':
          return FILE_ROW_HEIGHT;
        case 'search-file':
          return FILE_ROW_HEIGHT;
        case 'loading':
          return LOADING_ROW_HEIGHT;
        default:
          return COMMAND_ROW_HEIGHT;
      }
    },
    [virtualRows],
  );

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => listRef.current,
    estimateSize,
    overscan: 8,
  });

  // Reset selection when effective query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [effectiveQuery, isCommandMode]);

  // Search files when query has no good command matches (skip in command mode)
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = query.trim();
    if (!q || q.length < 2 || q.startsWith('>')) {
      setFileResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        let results: SearchResult[] = [];
        try {
          const enhanced = await TauriAPI.enhancedSearch(q, undefined, 10);
          results = enhanced.results;
        } catch {
          try {
            results = await TauriAPI.searchTokens(q, 10);
          } catch {
            /* ignore */
          }
        }
        if (results.length === 0 && currentPath && !currentPath.startsWith('xplorer://')) {
          try {
            const paths = await TauriAPI.findFiles(q, currentPath);
            results = paths.slice(0, 10).map((p) => ({
              path: p,
              filename: p.split(/[/\\]/).pop() || p,
              matches: [],
              score: 1,
              relevance_type: 'filesystem',
            }));
          } catch {
            /* ignore */
          }
        }
        setFileResults(results);
      } catch {
        setFileResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [query, currentPath]);

  // Scroll selected item into view via virtualizer
  useEffect(() => {
    // Find the virtual row index that corresponds to the selected itemIndex
    const rowIndex = virtualRows.findIndex(
      (row) =>
        row.kind !== 'section-header' && row.kind !== 'loading' && row.itemIndex === selectedIndex,
    );
    if (rowIndex >= 0) {
      virtualizer.scrollToIndex(rowIndex, { align: 'auto' });
    }
  }, [selectedIndex, virtualRows, virtualizer]);

  const executeItem = useCallback(
    (index: number) => {
      if (index < paletteItems.length) {
        const item = paletteItems[index];
        if (item.type === 'command') {
          // Record in history
          addToHistory(item.command.id, item.command.title);
          onClose();
          requestAnimationFrame(() => {
            item.command.action();
          });
        } else if (item.type === 'recent-file') {
          onClose();
          if (onFileSelect) {
            const hasExt = item.file.name.includes('.') && !item.file.name.startsWith('.');
            requestAnimationFrame(() => {
              onFileSelect(item.file.path, !hasExt);
            });
          }
        }
      } else {
        // It's a search file result
        const fileIndex = index - paletteItems.length;
        const file = fileResults[fileIndex];
        if (file && onFileSelect) {
          onClose();
          const hasExt = file.filename.includes('.') && !file.filename.startsWith('.');
          requestAnimationFrame(() => {
            onFileSelect(file.path, !hasExt);
          });
        }
      }
    },
    [paletteItems, fileResults, onClose, onFileSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
          break;
        case 'Enter':
          e.preventDefault();
          executeItem(selectedIndex);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
          } else {
            setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
          }
          break;
      }
    },
    [totalItems, selectedIndex, executeItem, onClose],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const clearQuery = useCallback(() => {
    setQuery('');
  }, []);

  if (!isOpen) return null;

  // ── Render a single virtual row ──────────────────────────────────────────

  const renderVirtualRow = (row: VirtualRow) => {
    switch (row.kind) {
      case 'section-header':
        return <div style={sectionHeaderStyle}>{row.label}</div>;

      case 'command': {
        const isSelected = row.itemIndex === selectedIndex;
        const isFav = favoriteSet.has(row.command.id);
        const ts = historyTimestamps.get(row.command.id);
        return (
          <button
            data-index={row.itemIndex}
            style={isSelected ? itemSelectedStyle : itemBaseStyle}
            onClick={() => executeItem(row.itemIndex)}
            onMouseEnter={() => setSelectedIndex(row.itemIndex)}
          >
            {row.command.icon ? (
              <span style={iconWrapStyle}>{row.command.icon}</span>
            ) : ts !== undefined ? (
              <span style={iconWrapStyle}>
                <ClockIcon size={14} />
              </span>
            ) : null}
            <span style={textEllipsisStyle}>
              <HighlightedText text={row.command.title} matchIndices={row.matchIndices} />
            </span>
            {/* Timestamp for recent commands */}
            {ts !== undefined && !effectiveQuery && (
              <span style={timestampStyle}>{formatTimestamp(ts)}</span>
            )}
            {/* Shortcut badge */}
            {row.command.shortcut && <span style={shortcutStyle}>{row.command.shortcut}</span>}
            {/* Star toggle */}
            <button
              style={{
                ...starBtnBaseStyle,
                opacity: isFav ? 1 : isSelected ? 0.6 : 0.4,
              }}
              onClick={(e) => toggleFavorite(row.command.id, e)}
              title={isFav ? t('commandPalette.removeFromFavorites') : t('commandPalette.addToFavorites')}
            >
              <StarIcon filled={isFav} size={13} />
            </button>
          </button>
        );
      }

      case 'recent-file': {
        const rf = row.file;
        const hasExt = rf.name.includes('.') && !rf.name.startsWith('.');
        const isDir = !hasExt;
        const parentPath = rf.path.replace(/[/\\][^/\\]+$/, '');
        const isSelected = row.itemIndex === selectedIndex;
        return (
          <button
            data-index={row.itemIndex}
            style={isSelected ? itemSelectedStyle : itemBaseStyle}
            onClick={() => executeItem(row.itemIndex)}
            onMouseEnter={() => setSelectedIndex(row.itemIndex)}
          >
            <span style={iconWrapStyle}>{isDir ? <Folder size={14} /> : <File size={14} />}</span>
            <span style={fileNameContainerStyle}>
              <span style={fileNameStyle}>{rf.name}</span>
              <span style={filePathStyle}>{parentPath}</span>
            </span>
            <span style={timestampStyle}>{formatTimestamp(rf.accessed_at * 1000)}</span>
          </button>
        );
      }

      case 'search-file': {
        const result = row.result;
        const hasExt = result.filename.includes('.') && !result.filename.startsWith('.');
        const isDir = !hasExt;
        const parentPath = result.path.replace(/[/\\][^/\\]+$/, '');
        const isSelected = row.itemIndex === selectedIndex;
        return (
          <button
            data-index={row.itemIndex}
            style={isSelected ? itemSelectedStyle : itemBaseStyle}
            onClick={() => executeItem(row.itemIndex)}
            onMouseEnter={() => setSelectedIndex(row.itemIndex)}
          >
            <span style={iconWrapStyle}>{isDir ? <Folder size={14} /> : <File size={14} />}</span>
            <span style={fileNameContainerStyle}>
              <span style={fileNameStyle}>{result.filename}</span>
              <span style={filePathStyle}>{parentPath}</span>
            </span>
            <span style={timestampStyle}>{isDir ? 'Folder' : 'File'}</span>
          </button>
        );
      }

      case 'loading':
        return (
          <div style={loadingContainerStyle}>
            <div style={loadingSpinnerStyle} />
            {t('commandPalette.searchingFiles')}
          </div>
        );
    }
  };

  const hasContent = virtualRows.length > 0;

  return (
    <div style={backdropStyle} onClick={handleBackdropClick} data-command-palette>
      <div style={dialogStyle} onClick={stopPropagation}>
        {/* Search Input */}
        <div style={searchBarStyle}>
          <svg style={searchIconStyle} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('commandPalette.placeholder')}
            style={inputStyle}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button onClick={clearQuery} style={clearBtnStyle}>
              <svg style={clearIconStyle} fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Results List - Virtualized */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {!hasContent && !isSearching ? (
            <div style={emptyStateStyle}>{t('commandPalette.noResults')}</div>
          ) : (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = virtualRows[virtualRow.index];
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {renderVirtualRow(row)}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div style={footerStyle}>
          <span>
            <kbd style={kbdStyle}>&#8593;&#8595;</kbd> {t('commandPalette.navigate')}
          </span>
          <span>
            <kbd style={kbdStyle}>Enter</kbd> {t('commandPalette.selectAction')}
          </span>
          <span>
            <kbd style={kbdStyle}>Esc</kbd> {t('commandPalette.closeAction')}
          </span>
          <span style={{ marginLeft: 'auto' }}>
            <StarIcon filled={false} size={11} /> {t('commandPalette.favorite')}
          </span>
        </div>
      </div>
    </div>
  );
}

export default React.memo(CommandPaletteInner);
