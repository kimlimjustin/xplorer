import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TauriAPI, type FileEntry } from '@/lib/tauri-api';
import { detectSep } from '@/lib/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PasteRenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileEntry[];
  onComplete?: () => void;
}

type SortStrategy = 'as-selected' | 'by-name' | 'by-date' | 'by-size';

interface ValidationError {
  index: number;
  type: 'duplicate' | 'invalid-chars' | 'exists-in-dir' | 'extension-change';
  message: string;
}

// Invalid filename characters on Windows
const INVALID_CHARS = /[/\\:*?"<>|]/;
const INVALID_CHARS_DISPLAY = '/ \\ : * ? " < > |';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getExtension = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : '';
};

const sortFilesByStrategy = (files: FileEntry[], strategy: SortStrategy): FileEntry[] => {
  const sorted = [...files];
  switch (strategy) {
    case 'by-name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'by-date':
      sorted.sort((a, b) => a.modified - b.modified);
      break;
    case 'by-size':
      sorted.sort((a, b) => a.size - b.size);
      break;
    case 'as-selected':
    default:
      break;
  }
  return sorted;
};

// ── Drag state ────────────────────────────────────────────────────────────────

const useDragReorder = (items: FileEntry[], setItems: (files: FileEntry[]) => void) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((index: number) => {
    setOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      const reordered = [...items];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(overIndex, 0, moved);
      setItems(reordered);
    }
    setDragIndex(null);
    setOverIndex(null);
  }, [dragIndex, overIndex, items, setItems]);

  return { dragIndex, overIndex, handleDragStart, handleDragOver, handleDragEnd };
};

// ── Component ─────────────────────────────────────────────────────────────────

const PasteRenameDialog = React.memo(function PasteRenameDialog({
  isOpen,
  onClose,
  files,
  onComplete,
}: PasteRenameDialogProps) {
  const [orderedFiles, setOrderedFiles] = useState<FileEntry[]>([]);
  const [sortStrategy, setSortStrategy] = useState<SortStrategy>('as-selected');
  const [rawText, setRawText] = useState('');
  const [parsedNames, setParsedNames] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const drag = useDragReorder(orderedFiles, setOrderedFiles);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen && files.length > 0) {
      setOrderedFiles([...files]);
      setSortStrategy('as-selected');
      setRawText('');
      setParsedNames([]);
      setIsApplying(false);
      setErrors([]);

      // Load existing filenames in the directory
      const parentDir = files[0].path.split(/[/\\]/).slice(0, -1).join(detectSep(files[0].path));
      TauriAPI.readDirectory(parentDir)
        .then((entries) => {
          const names = new Set(entries.map((e) => e.name.toLowerCase()));
          setExistingNames(names);
        })
        .catch(() => setExistingNames(new Set()));
    }
  }, [isOpen, files]);

  // Update order when sort strategy changes
  useEffect(() => {
    if (isOpen && files.length > 0) {
      setOrderedFiles(sortFilesByStrategy(files, sortStrategy));
    }
  }, [sortStrategy, files, isOpen]);

  // Parse raw text into names
  useEffect(() => {
    const names = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    setParsedNames(names);
  }, [rawText]);

  // Validation
  const validationErrors = useMemo((): ValidationError[] => {
    const errs: ValidationError[] = [];
    if (parsedNames.length === 0) return errs;

    const seenNames = new Map<string, number>();
    const renamedSet = new Set(orderedFiles.map((f) => f.name.toLowerCase()));

    for (let i = 0; i < parsedNames.length; i++) {
      if (i >= orderedFiles.length) break;

      const newName = parsedNames[i];
      const oldFile = orderedFiles[i];

      // Check invalid characters
      if (INVALID_CHARS.test(newName)) {
        errs.push({
          index: i,
          type: 'invalid-chars',
          message: `Contains invalid characters (${INVALID_CHARS_DISPLAY})`,
        });
      }

      // Check empty name
      if (newName.length === 0) {
        errs.push({
          index: i,
          type: 'invalid-chars',
          message: 'Name cannot be empty',
        });
      }

      // Check duplicates within paste list
      const lower = newName.toLowerCase();
      if (seenNames.has(lower)) {
        errs.push({
          index: i,
          type: 'duplicate',
          message: `Duplicate of line ${seenNames.get(lower)! + 1}`,
        });
      }
      seenNames.set(lower, i);

      // Check if name already exists in directory (exclude files being renamed)
      if (existingNames.has(lower) && !renamedSet.has(lower)) {
        errs.push({
          index: i,
          type: 'exists-in-dir',
          message: 'A file with this name already exists in the directory',
        });
      }

      // Warn on extension change
      const oldExt = getExtension(oldFile.name).toLowerCase();
      const newExt = getExtension(newName).toLowerCase();
      if (oldExt && newExt !== oldExt && !oldFile.is_dir) {
        errs.push({
          index: i,
          type: 'extension-change',
          message: `Extension changes from "${oldExt}" to "${newExt || '(none)'}"`,
        });
      }
    }

    return errs;
  }, [parsedNames, orderedFiles, existingNames]);

  const hasBlockingErrors = useMemo(
    () =>
      validationErrors.some(
        (e) => e.type === 'duplicate' || e.type === 'invalid-chars' || e.type === 'exists-in-dir',
      ),
    [validationErrors],
  );

  const countMismatch = parsedNames.length > 0 && parsedNames.length !== orderedFiles.length;
  const canApply = parsedNames.length > 0 && !hasBlockingErrors && !isApplying;

  // Get error set per line index for quick lookup
  const errorsByIndex = useMemo(() => {
    const map = new Map<number, ValidationError[]>();
    for (const err of validationErrors) {
      const existing = map.get(err.index) || [];
      existing.push(err);
      map.set(err.index, existing);
    }
    return map;
  }, [validationErrors]);

  // Apply renames
  const handleApply = useCallback(async () => {
    if (!canApply) return;
    setIsApplying(true);
    setErrors([]);

    const renameErrors: string[] = [];
    let _succeeded = 0;

    for (let i = 0; i < Math.min(parsedNames.length, orderedFiles.length); i++) {
      const file = orderedFiles[i];
      const newName = parsedNames[i];

      if (newName === file.name) {
        _succeeded++;
        continue;
      }

      try {
        const sep = detectSep(file.path);
        const pathParts = file.path.split(/[/\\]/);
        pathParts[pathParts.length - 1] = newName;
        const newPath = pathParts.join(sep);
        await TauriAPI.rename(file.path, newPath);
        _succeeded++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        renameErrors.push(`"${file.name}": ${msg}`);
      }
    }

    setIsApplying(false);

    if (renameErrors.length > 0) {
      setErrors(renameErrors);
    } else {
      onComplete?.();
      onClose();
    }
  }, [canApply, parsedNames, orderedFiles, onComplete, onClose]);

  // Keyboard handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const effectiveCount = Math.min(parsedNames.length, orderedFiles.length);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '780px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--xp-surface)',
          border: '1px solid var(--xp-border)',
          borderRadius: '12px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--xp-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--xp-blue)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <path d="M9 14h6" />
              <path d="M9 18h6" />
              <path d="M12 10v8" />
            </svg>
            <span style={{ color: 'var(--xp-text)', fontSize: '14px', fontWeight: 600 }}>
              Paste &amp; Rename — {orderedFiles.length} files
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--xp-text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--xp-text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--xp-text-muted)')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Sort Strategy */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--xp-border)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: 'var(--xp-text-secondary)', fontSize: '12px', fontWeight: 500 }}>
            Order:
          </span>
          {(
            [
              ['as-selected', 'As Selected'],
              ['by-name', 'By Name (A-Z)'],
              ['by-date', 'By Date (Oldest First)'],
              ['by-size', 'By Size (Smallest First)'],
            ] as [SortStrategy, string][]
          ).map(([value, label]) => (
            <label
              key={value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                fontSize: '12px',
                color: sortStrategy === value ? 'var(--xp-blue)' : 'var(--xp-text-secondary)',
              }}
            >
              <input
                type="radio"
                name="sort-strategy"
                value={value}
                checked={sortStrategy === value}
                onChange={() => setSortStrategy(value)}
                style={{ accentColor: 'var(--xp-blue)' }}
              />
              {label}
            </label>
          ))}
        </div>

        {/* Main Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Paste Area */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--xp-text-secondary)',
                marginBottom: '6px',
              }}
            >
              Paste new names (one per line):
            </label>
            <textarea
              ref={textareaRef}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Enter ${orderedFiles.length} names, one per line...\n\ne.g.\nphoto-001.jpg\nphoto-002.jpg\nphoto-003.jpg`}
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: '100px',
                maxHeight: '160px',
                resize: 'vertical',
                backgroundColor: 'var(--xp-surface-light)',
                color: 'var(--xp-text)',
                border: '1px solid var(--xp-border)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '13px',
                fontFamily: 'monospace',
                lineHeight: '1.5',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--xp-blue)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--xp-border)')}
            />
          </div>

          {/* Count Mismatch Warning */}
          {countMismatch && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--xp-yellow)',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>
                Count mismatch: {parsedNames.length} name{parsedNames.length !== 1 ? 's' : ''}{' '}
                pasted for {orderedFiles.length} file{orderedFiles.length !== 1 ? 's' : ''}.
                {parsedNames.length > orderedFiles.length
                  ? ` Extra ${parsedNames.length - orderedFiles.length} name(s) will be ignored.`
                  : ` Last ${orderedFiles.length - parsedNames.length} file(s) will keep their current names.`}
              </span>
            </div>
          )}

          {/* Errors from apply */}
          {errors.length > 0 && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(248, 113, 113, 0.1)',
                border: '1px solid rgba(248, 113, 113, 0.3)',
                fontSize: '12px',
                color: 'var(--xp-red)',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Rename errors:</div>
              {errors.map((err, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i}>{err}</div>
              ))}
            </div>
          )}

          {/* Preview Table */}
          {parsedNames.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--xp-text-secondary)',
                  marginBottom: '8px',
                }}
              >
                Preview ({effectiveCount} rename{effectiveCount !== 1 ? 's' : ''}):
              </div>
              <div
                style={{
                  border: '1px solid var(--xp-border)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              >
                {/* Table Header */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr 28px 1fr',
                    padding: '8px 12px',
                    backgroundColor: 'var(--xp-surface-light)',
                    borderBottom: '1px solid var(--xp-border)',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--xp-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  <span>#</span>
                  <span>Current Name</span>
                  <span />
                  <span>New Name</span>
                </div>

                {/* Table Body */}
                <div style={{ maxHeight: '280px', overflow: 'auto' }}>
                  {orderedFiles.map((file, index) => {
                    const newName = index < parsedNames.length ? parsedNames[index] : null;
                    const lineErrors = errorsByIndex.get(index) || [];
                    const hasError = lineErrors.some((e) => e.type !== 'extension-change');
                    const hasWarning = lineErrors.some((e) => e.type === 'extension-change');
                    const isUnchanged = newName === file.name;
                    const isDragOver =
                      drag.overIndex === index &&
                      drag.dragIndex !== null &&
                      drag.dragIndex !== index;

                    return (
                      <div
                        key={file.path}
                        draggable
                        onDragStart={() => drag.handleDragStart(index)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          drag.handleDragOver(index);
                        }}
                        onDragEnd={drag.handleDragEnd}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '32px 1fr 28px 1fr',
                          padding: '6px 12px',
                          alignItems: 'center',
                          fontSize: '12px',
                          borderBottom: '1px solid var(--xp-border)',
                          backgroundColor: (() => {
                            if (hasError) return 'rgba(248, 113, 113, 0.08)';
                            if (hasWarning) return 'rgba(251, 191, 36, 0.06)';
                            if (isDragOver) return 'rgba(99, 102, 241, 0.1)';
                            return 'transparent';
                          })(),
                          transition: 'background-color 0.15s',
                          cursor: 'grab',
                          opacity: drag.dragIndex === index ? 0.5 : 1,
                        }}
                      >
                        {/* Row number / drag handle */}
                        <span
                          style={{
                            color: 'var(--xp-text-muted)',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            opacity={0.4}
                          >
                            <circle cx="9" cy="5" r="1" />
                            <circle cx="9" cy="12" r="1" />
                            <circle cx="9" cy="19" r="1" />
                            <circle cx="15" cy="5" r="1" />
                            <circle cx="15" cy="12" r="1" />
                            <circle cx="15" cy="19" r="1" />
                          </svg>
                          {index + 1}
                        </span>

                        {/* Old name */}
                        <span
                          style={{
                            color: 'var(--xp-text)',
                            fontFamily: 'monospace',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={file.name}
                        >
                          {file.name}
                        </span>

                        {/* Arrow */}
                        <span
                          style={{
                            display: 'flex',
                            justifyContent: 'center',
                            color: (() => {
                              if (!newName) return 'var(--xp-text-muted)';
                              if (isUnchanged) return 'var(--xp-text-muted)';
                              if (hasError) return 'var(--xp-red)';
                              return 'var(--xp-blue)';
                            })(),
                          }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M5 12h14" />
                            <path d="m12 5 7 7-7 7" />
                          </svg>
                        </span>

                        {/* New name */}
                        <div style={{ minWidth: 0 }}>
                          {newName ? (
                            <div>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: 'block',
                                  // eslint-disable-next-line no-nested-ternary
                                  color: hasError
                                    ? 'var(--xp-red)'
                                    : isUnchanged
                                      ? 'var(--xp-text-muted)'
                                      : 'var(--xp-green)',
                                  fontStyle: isUnchanged ? 'italic' : 'normal',
                                }}
                                title={newName}
                              >
                                {isUnchanged ? '(unchanged)' : newName}
                              </span>
                              {lineErrors.length > 0 && (
                                <div style={{ marginTop: '2px' }}>
                                  {lineErrors.map((err, ei) => (
                                    <div
                                      // eslint-disable-next-line react/no-array-index-key
                                      key={ei}
                                      style={{
                                        fontSize: '10px',
                                        color:
                                          err.type === 'extension-change'
                                            ? 'var(--xp-yellow)'
                                            : 'var(--xp-red)',
                                        lineHeight: '1.3',
                                      }}
                                    >
                                      {err.type === 'extension-change' ? '\u26A0' : '\u2716'}{' '}
                                      {err.message}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span
                              style={{
                                color: 'var(--xp-text-muted)',
                                fontStyle: 'italic',
                                fontSize: '11px',
                              }}
                            >
                              (no name provided)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--xp-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--xp-text-muted)' }}>
            {validationErrors.filter((e) => e.type !== 'extension-change').length > 0 && (
              <span style={{ color: 'var(--xp-red)' }}>
                {validationErrors.filter((e) => e.type !== 'extension-change').length} error(s)
              </span>
            )}
            {validationErrors.filter((e) => e.type === 'extension-change').length > 0 && (
              <span
                style={{
                  color: 'var(--xp-yellow)',
                  marginLeft:
                    validationErrors.filter((e) => e.type !== 'extension-change').length > 0
                      ? '8px'
                      : undefined,
                }}
              >
                {validationErrors.filter((e) => e.type === 'extension-change').length} warning(s)
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '7px 16px',
                borderRadius: '6px',
                border: '1px solid var(--xp-border)',
                backgroundColor: 'transparent',
                color: 'var(--xp-text-secondary)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--xp-surface-light)';
                e.currentTarget.style.color = 'var(--xp-text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--xp-text-secondary)';
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!canApply}
              style={{
                padding: '7px 20px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: canApply ? 'var(--xp-blue)' : 'var(--xp-surface-light)',
                color: canApply ? '#fff' : 'var(--xp-text-muted)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: canApply ? 'pointer' : 'not-allowed',
                opacity: isApplying ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onMouseEnter={(e) => {
                if (canApply) e.currentTarget.style.backgroundColor = 'var(--xp-blue-dark)';
              }}
              onMouseLeave={(e) => {
                if (canApply) e.currentTarget.style.backgroundColor = 'var(--xp-blue)';
              }}
            >
              {isApplying && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ animation: 'spin 1s linear infinite' }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {isApplying ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default PasteRenameDialog;
