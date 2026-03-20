import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronRight, Pencil, HardDrive, Home, Trash2, Cloud, Folder } from 'lucide-react';
import { PATH_SEPARATOR, isWindows } from '@/lib/constants';
import { TauriAPI } from '@/lib/tauri-api';
import { getCollection } from '@/lib/collections';
import { renderIcon } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface NavigationBarProps {
  currentPath: string;
  navigateToPath?: (path: string) => void;
  refetch?: () => void;
}

interface PathSegment {
  name: string;
  fullPath: string;
}

interface AutocompleteSuggestion {
  name: string;
  fullPath: string;
}

const SPECIAL_PATHS_CONFIG: Record<string, { labelKey: string; icon: React.ReactNode }> = {
  'xplorer://home': { labelKey: 'navigation.home', icon: <Home size={14} /> },
  'xplorer://trash': { labelKey: 'navigation.trash', icon: <Trash2 size={14} /> },
  'xplorer://gdrive-manager': { labelKey: 'navigation.googleDrive', icon: <Cloud size={14} /> },
};

const AUTOCOMPLETE_DEBOUNCE_MS = 200;
const VALIDATION_DEBOUNCE_MS = 300;
const MAX_VISIBLE_SUGGESTIONS = 8;

/** Cache the home directory so we only fetch it once. */
let cachedHomeDir: string | null = null;

async function getHomeDir(): Promise<string> {
  if (cachedHomeDir) return cachedHomeDir;
  try {
    const dirs = await TauriAPI.getUserDirectories();
    cachedHomeDir = dirs.home;
    return cachedHomeDir;
  } catch {
    // Fallback
    return isWindows ? 'C:\\Users' : '/home';
  }
}

/**
 * Expand `~` or `~/...` to the user's home directory.
 * Returns the expanded path, or the original if no tilde.
 */
async function expandTilde(inputPath: string): Promise<string> {
  if (!inputPath.startsWith('~')) return inputPath;
  const home = await getHomeDir();
  if (inputPath === '~') return home;
  if (inputPath.startsWith('~/') || inputPath.startsWith('~\\')) {
    return home + inputPath.slice(1);
  }
  return inputPath;
}

/**
 * Extract the parent directory and the typed prefix from an input path.
 * For example: "C:\Users\fo" -> parentDir="C:\Users\", prefix="fo"
 *              "C:\Users\" -> parentDir="C:\Users\", prefix=""
 */
const splitParentAndPrefix = (inputPath: string): { parentDir: string; prefix: string } => {
  const sep = inputPath.includes('/') ? '/' : '\\';
  const lastSepIdx = inputPath.lastIndexOf(sep);
  if (lastSepIdx === -1) {
    return { parentDir: '', prefix: inputPath };
  }
  return {
    parentDir: inputPath.slice(0, lastSepIdx + 1),
    prefix: inputPath.slice(lastSepIdx + 1),
  };
}

const parseBreadcrumbSegments = (path: string) : PathSegment[] => {
  if (!path) return [];
  if (
    path.startsWith('xplorer://') ||
    path.startsWith('gdrive://') ||
    path.startsWith('comparison://') ||
    path.startsWith('collection://')
  )
    return [];

  const segments: PathSegment[] = [];
  const isWin = /^[A-Za-z]:/.test(path);

  if (isWin) {
    const parts = path.split(/[\\/]/).filter(Boolean);
    if (parts.length === 0) return [];
    let accumulated = parts[0] + PATH_SEPARATOR;
    segments.push({ name: parts[0], fullPath: accumulated });
    for (let i = 1; i < parts.length; i++) {
      accumulated = accumulated + parts[i] + (i < parts.length - 1 ? PATH_SEPARATOR : '');
      segments.push({
        name: parts[i],
        fullPath: accumulated.endsWith(PATH_SEPARATOR) ? accumulated : accumulated + PATH_SEPARATOR,
      });
    }
  } else {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) {
      segments.push({ name: '/', fullPath: '/' });
      return segments;
    }
    segments.push({ name: '/', fullPath: '/' });
    let accumulated = '/';
    for (let i = 0; i < parts.length; i++) {
      accumulated = accumulated + parts[i] + '/';
      segments.push({ name: parts[i], fullPath: accumulated });
    }
  }
  return segments;
}

// ── Validation state type ──────────────────────────────────────────────────────

type PathValidation = 'idle' | 'valid' | 'invalid' | 'checking';

const NavigationBar = ({
  currentPath,
  navigateToPath,
  refetch: _refetch,
}: NavigationBarProps) => {
  const { t } = useTranslation();
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [editPathValue, setEditPathValue] = useState(currentPath);
  const pathInputRef = useRef<HTMLInputElement>(null);

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Validation state
  const [validation, setValidation] = useState<PathValidation>('idle');
  const validationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track whether a suggestion was just selected (to skip re-fetching)
  const justSelectedRef = useRef(false);

  useEffect(() => {
    if (!isEditingPath) setEditPathValue(currentPath);
  }, [currentPath, isEditingPath]);
  useEffect(() => {
    if (isEditingPath && pathInputRef.current) {
      pathInputRef.current.focus();
      pathInputRef.current.select();
    }
  }, [isEditingPath]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
      if (validationTimer.current) clearTimeout(validationTimer.current);
    };
  }, []);

  // ── Fetch autocomplete suggestions ──────────────────────────────────────────

  const fetchSuggestions = useCallback(async (inputPath: string) => {
    if (!inputPath || inputPath.startsWith('xplorer://')) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    try {
      const expanded = await expandTilde(inputPath);
      const { parentDir, prefix } = splitParentAndPrefix(expanded);

      if (!parentDir) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      const entries = await TauriAPI.readDirectory(parentDir);
      const dirs = entries
        .filter((e) => e.is_dir)
        .filter((e) => {
          if (!prefix) return true;
          return e.name.toLowerCase().startsWith(prefix.toLowerCase());
        })
        .slice(0, 50) // Cap fetch results
        .map((e) => ({
          name: e.name,
          fullPath:
            e.path.endsWith(PATH_SEPARATOR) || e.path.endsWith('/')
              ? e.path
              : e.path + PATH_SEPARATOR,
        }));

      setSuggestions(dirs);
      setSelectedIndex(-1);
      setShowDropdown(dirs.length > 0);
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, []);

  // ── Validate path existence ─────────────────────────────────────────────────

  const validatePath = useCallback(async (inputPath: string) => {
    if (!inputPath || inputPath.startsWith('xplorer://')) {
      setValidation('idle');
      return;
    }

    setValidation('checking');
    try {
      const expanded = await expandTilde(inputPath);
      await TauriAPI.getFileProperties(expanded);
      setValidation('valid');
    } catch {
      setValidation('invalid');
    }
  }, []);

  // ── Debounced autocomplete + validation on input change ─────────────────────

  const handleInputChange = useCallback(
    (value: string) => {
      setEditPathValue(value);

      if (justSelectedRef.current) {
        justSelectedRef.current = false;
      }

      // Debounced autocomplete
      if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
      autocompleteTimer.current = setTimeout(() => {
        fetchSuggestions(value);
      }, AUTOCOMPLETE_DEBOUNCE_MS);

      // Debounced validation
      if (validationTimer.current) clearTimeout(validationTimer.current);
      validationTimer.current = setTimeout(() => {
        validatePath(value);
      }, VALIDATION_DEBOUNCE_MS);
    },
    [fetchSuggestions, validatePath],
  );

  // ── Handle suggestion selection ─────────────────────────────────────────────

  const selectSuggestion = useCallback(
    (suggestion: AutocompleteSuggestion) => {
      justSelectedRef.current = true;
      setEditPathValue(suggestion.fullPath);
      setShowDropdown(false);
      setSuggestions([]);
      setSelectedIndex(-1);
      setValidation('valid'); // A directory we just read from must be valid
      pathInputRef.current?.focus();

      // After selecting, immediately fetch children of that directory for further navigation
      if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
      autocompleteTimer.current = setTimeout(() => {
        fetchSuggestions(suggestion.fullPath);
      }, AUTOCOMPLETE_DEBOUNCE_MS);
    },
    [fetchSuggestions],
  );

  // ── Submit / Cancel ─────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    setIsEditingPath(false);
    setShowDropdown(false);
    setSuggestions([]);
    setValidation('idle');
    const trimmed = editPathValue.trim();
    if (trimmed && trimmed !== currentPath && navigateToPath) {
      const expanded = await expandTilde(trimmed);
      navigateToPath(expanded);
    }
  }, [editPathValue, currentPath, navigateToPath]);

  const handleCancel = useCallback(() => {
    setIsEditingPath(false);
    setEditPathValue(currentPath);
    setShowDropdown(false);
    setSuggestions([]);
    setValidation('idle');
  }, [currentPath]);

  // ── Keyboard handling ───────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        if (showDropdown) {
          e.preventDefault();
          setShowDropdown(false);
          setSelectedIndex(-1);
        } else {
          handleCancel();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (showDropdown && selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectSuggestion(suggestions[selectedIndex]);
        } else {
          handleSubmit();
        }
        return;
      }

      if (e.key === 'Tab' && showDropdown && suggestions.length > 0) {
        e.preventDefault();
        const idx = selectedIndex >= 0 ? selectedIndex : 0;
        if (suggestions[idx]) {
          selectSuggestion(suggestions[idx]);
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!showDropdown && suggestions.length > 0) {
          setShowDropdown(true);
        }
        setSelectedIndex((prev) => {
          const next = prev + 1;
          return next >= suggestions.length ? 0 : next;
        });
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? suggestions.length - 1 : next;
        });
        return;
      }
    },
    [showDropdown, selectedIndex, suggestions, selectSuggestion, handleSubmit, handleCancel],
  );

  // ── Scroll selected suggestion into view ────────────────────────────────────

  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll('[data-suggestion]');
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // ── Handle blur carefully (delay to allow click on dropdown) ────────────────

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // If the new focus target is inside our dropdown, don't close
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      if (relatedTarget && dropdownRef.current?.contains(relatedTarget)) {
        return;
      }
      // Small delay to allow suggestion click to register
      setTimeout(() => {
        if (document.activeElement !== pathInputRef.current) {
          handleSubmit();
        }
      }, 150);
    },
    [handleSubmit],
  );

  // ── Validation border style ─────────────────────────────────────────────────

  const validationBorderColor = (() => {
    switch (validation) {
      case 'valid':
        return 'var(--xp-success, #4ade80)';
      case 'invalid':
        return 'var(--xp-error, #f87171)';
      case 'checking':
        return 'var(--xp-warning, #facc15)';
      default:
        return undefined;
    }
  })();

  const segments = parseBreadcrumbSegments(currentPath);
  const specialConfig = SPECIAL_PATHS_CONFIG[currentPath];
  const special = specialConfig ? { label: t(specialConfig.labelKey), icon: specialConfig.icon } : null;

  // Resolve collection name for collection:// paths
  const collectionLabel = useMemo((): React.ReactNode | null => {
    if (!currentPath.startsWith('collection://')) return null;
    const id = currentPath.replace('collection://', '');
    const col = getCollection(id);
    if (!col) return t('navigation.collection');
    return (
      <>
        <span className="inline-flex items-center mr-1">{renderIcon(col.icon, 14)}</span>
        {col.name}
      </>
    );
  }, [currentPath]);

  return (
    <div className="bg-xp-surface border-b border-xp-border px-3 py-1">
      <div
        className="bg-xp-bg border border-xp-border rounded px-2 py-0.5 flex items-center min-w-0 relative"
        style={
          isEditingPath && validationBorderColor
            ? {
                borderColor: validationBorderColor,
                transition: 'border-color 0.2s ease',
              }
            : undefined
        }
        onClick={() => {
          if (!isEditingPath) setIsEditingPath(true);
        }}
      >
        {isEditingPath ? (
          <div className="w-full relative">
            <div className="flex items-center gap-1.5 w-full">
              {/* Validation indicator dot */}
              {validation !== 'idle' && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    flexShrink: 0,
                    backgroundColor: validationBorderColor,
                    transition: 'background-color 0.2s ease',
                  }}
                  title={
                    validation === 'valid'
                      ? t('navigation.pathExists')
                      : validation === 'invalid'
                        ? t('navigation.pathNotFound')
                        : t('navigation.checking')
                  }
                />
              )}
              <input
                ref={pathInputRef}
                type="text"
                value={editPathValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="w-full bg-transparent text-sm outline-none"
                placeholder={t('navigation.pathPlaceholder')}
                aria-label={t('navigation.filePath')}
                aria-expanded={showDropdown}
                aria-autocomplete="list"
                aria-controls={showDropdown ? 'nav-autocomplete-list' : undefined}
                aria-activedescendant={
                  selectedIndex >= 0 ? `nav-suggestion-${selectedIndex}` : undefined
                }
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* ── Autocomplete Dropdown ── */}
            {showDropdown && suggestions.length > 0 && (
              <div
                ref={dropdownRef}
                id="nav-autocomplete-list"
                role="listbox"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: -8,
                  right: -8,
                  marginTop: 4,
                  maxHeight: MAX_VISIBLE_SUGGESTIONS * 30,
                  overflowY: 'auto',
                  background: 'var(--xp-surface, rgba(30, 30, 46, 0.95))',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid var(--xp-border, rgba(255,255,255,0.1))',
                  borderRadius: 6,
                  zIndex: 9999,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  padding: '4px 0',
                }}
              >
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={suggestion.fullPath}
                    data-suggestion
                    id={`nav-suggestion-${idx}`}
                    role="option"
                    aria-selected={idx === selectedIndex}
                    tabIndex={-1}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent input blur
                      selectSuggestion(suggestion);
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontSize: 13,
                      color:
                        idx === selectedIndex
                          ? 'var(--xp-text, #e0e0e0)'
                          : 'var(--xp-text-muted, #a0a0a0)',
                      backgroundColor:
                        idx === selectedIndex
                          ? 'var(--xp-accent, rgba(100, 108, 255, 0.25))'
                          : 'transparent',
                      borderRadius: 4,
                      margin: '0 4px',
                      transition: 'background-color 0.1s ease, color 0.1s ease',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    <Folder
                      size={14}
                      style={{
                        flexShrink: 0,
                        color: 'var(--xp-accent, #646cff)',
                        opacity: 0.8,
                      }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {suggestion.name}
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 11,
                        color: 'var(--xp-text-muted, #666)',
                        opacity: 0.6,
                        flexShrink: 0,
                      }}
                    >
                      {suggestion.fullPath}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : special ? (
          <div className="flex items-center gap-2 h-full cursor-text px-1">
            <span className="text-xp-text-muted">{special.icon}</span>
            <span className="text-sm font-medium">{special.label}</span>
          </div>
        ) : collectionLabel ? (
          <div className="flex items-center gap-2 h-full cursor-text px-1">
            <span className="text-sm font-medium">{collectionLabel}</span>
          </div>
        ) : (
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-0.5 overflow-x-auto h-full scrollbar-none cursor-text"
          >
            {segments.map((seg, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <ChevronRight size={12} className="flex-shrink-0 text-xp-text-muted opacity-60" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToPath?.(seg.fullPath);
                  }}
                  className={`px-1.5 py-0.5 rounded text-sm truncate max-w-[160px] flex-shrink-0 hover:bg-xp-surface-light transition-colors ${
                    i === segments.length - 1
                      ? 'font-semibold text-xp-text'
                      : 'text-xp-text-muted hover:text-xp-text'
                  }`}
                  title={seg.fullPath}
                  aria-current={i === segments.length - 1 ? 'location' : undefined}
                  aria-label={t('navigation.navigateTo', { name: seg.name })}
                >
                  {i === 0 && /^[A-Za-z]:$/.test(seg.name) ? (
                    <span className="flex items-center gap-1">
                      <HardDrive size={12} className="flex-shrink-0" />
                      {seg.name}
                    </span>
                  ) : i === 0 && seg.name === '/' ? (
                    <span className="flex items-center gap-1">
                      <HardDrive size={12} className="flex-shrink-0" />/
                    </span>
                  ) : (
                    seg.name
                  )}
                </button>
              </React.Fragment>
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingPath(true);
              }}
              className="ml-1 p-0.5 rounded hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text transition-colors flex-shrink-0"
              title={t('navigation.editPath')}
              aria-label={t('navigation.editPath')}
            >
              <Pencil size={12} />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}

export default NavigationBar;
