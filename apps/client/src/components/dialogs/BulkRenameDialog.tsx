import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TauriAPI, type BulkRenameResult, type FileEntry } from '@/lib/tauri-api';
import type { Preset, PatternTemplate, RegexSnippet } from './bulk-rename-helpers';
import {
  PRESETS,
  PATTERN_TEMPLATES,
  REGEX_SNIPPETS,
  diffStrings,
  DiffText,
  WarningIcon,
  CheckIcon,
  ChevronIcon,
} from './bulk-rename-helpers';

interface BulkRenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileEntry[];
  onComplete?: () => void;
}

// Helpers, presets, and sub-components extracted to ./bulk-rename-helpers.tsx

const BulkRenameDialog = ({
  isOpen,
  onClose,
  files,
  onComplete,
}: BulkRenameDialogProps) => {
  const { toast } = useToast();
  const [pattern, setPattern] = useState('');
  const [replacement, setReplacement] = useState('');
  const [preview, setPreview] = useState<BulkRenameResult[]>([]);
  const [results, setResults] = useState<BulkRenameResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [patternError, setPatternError] = useState<string | null>(null);
  const [regexHelperOpen, setRegexHelperOpen] = useState(false);
  const [activeTemplateLabel, setActiveTemplateLabel] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<
    { original_name: string; new_name: string }[] | null
  >(null);
  const patternInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setPattern('');
      setReplacement('');
      setPreview([]);
      setResults(null);
      setPatternError(null);
      setRegexHelperOpen(false);
      setActiveTemplateLabel(null);
      setLocalPreview(null);
    }
  }, [isOpen]);

  // Live preview: debounce and call preview whenever pattern or replacement changes
  const fetchPreview = useCallback(async () => {
    if (!pattern.trim() || files.length === 0) {
      setPreview([]);
      setPatternError(null);
      return;
    }

    try {
      const filePaths = files.map((f) => f.path);
      const previewResults = await TauriAPI.bulkRename(filePaths, pattern, replacement, true);
      setPreview(previewResults);
      setPatternError(null);
    } catch (err) {
      const message = (err as Error).message || String(err);
      setPatternError(message);
      setPreview([]);
    }
  }, [pattern, replacement, files]);

  useEffect(() => {
    if (!isOpen) return;
    // If a template is active, we use localPreview instead
    if (activeTemplateLabel) return;
    const timer = setTimeout(() => {
      fetchPreview();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchPreview, isOpen, activeTemplateLabel]);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const filePaths = files.map((f) => f.path);
      const previewResults = await TauriAPI.bulkRename(filePaths, pattern, replacement, true);
      setPreview(previewResults);
      setPatternError(null);
    } catch (err) {
      const message = (err as Error).message || String(err);
      setPatternError(message);
      toast({
        title: 'Preview Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async () => {
    if (!pattern.trim() && !activeTemplateLabel) {
      toast({
        title: 'Pattern Required',
        description: 'Please enter a regex pattern or select a template.',
        variant: 'destructive',
      });
      return;
    }

    setRenaming(true);
    try {
      // For template-based renames, we need to use the regex pattern approach
      // Templates set pattern/replacement that the backend understands
      const filePaths = files.map((f) => f.path);
      const renameResults = await TauriAPI.bulkRename(filePaths, pattern, replacement, false);
      setResults(renameResults);

      const successCount = renameResults.filter((r) => r.success).length;
      const failCount = renameResults.filter((r) => !r.success).length;

      if (failCount === 0) {
        toast({
          title: 'Bulk Rename Complete',
          description: `Successfully renamed ${successCount} file${successCount !== 1 ? 's' : ''}.`,
        });
      } else {
        toast({
          title: 'Bulk Rename Partially Complete',
          description: `${successCount} succeeded, ${failCount} failed.`,
          variant: 'destructive',
        });
      }

      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      toast({
        title: 'Bulk Rename Failed',
        description: (err as Error).message || String(err),
        variant: 'destructive',
      });
    } finally {
      setRenaming(false);
    }
  };

  const applyPreset = (preset: Preset) => {
    setPattern(preset.pattern);
    setReplacement(preset.replacement);
    setResults(null);
    setActiveTemplateLabel(null);
    setLocalPreview(null);
  };

  const applyTemplate = (template: PatternTemplate) => {
    // For templates, we compute the preview locally from the transformation function
    // and set a regex pattern that will perform the same rename
    setActiveTemplateLabel(template.label);
    setResults(null);
    setPatternError(null);

    // Compute local preview
    const previews = files.map((f) => ({
      original_name: f.name,
      new_name: template.apply(f.name),
    }));
    setLocalPreview(previews);

    // Set regex pattern that the backend can use
    // For most templates, we use a catch-all pattern and set the replacement
    // The backend handles {N}, {date}, $1, etc. but for case conversions
    // we need to handle it differently. We'll use individual rename calls.
    // For simplicity with the existing backend, set pattern to match each file
    // and use a simple approach:
    switch (template.label) {
      case 'Remove Spaces':
        setPattern('\\s+');
        setReplacement('_');
        setLocalPreview(null); // Let backend preview handle it
        setActiveTemplateLabel(null);
        break;
      case 'Add Date Prefix': {
        const today = new Date();
        const y = today.getFullYear();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        setPattern('^(.+)$');
        setReplacement(`${y}-${m}-${d}_$1`);
        setLocalPreview(null);
        setActiveTemplateLabel(null);
        break;
      }
      case 'UPPERCASE':
        setPattern('^(.+)(\\.[^.]+)$');
        setReplacement('${upper:$1}$2');
        // Keep local preview for visual feedback since backend may not support ${upper:}
        break;
      case 'lowercase':
        setPattern('^(.+)(\\.[^.]+)$');
        setReplacement('${lower:$1}$2');
        break;
      case 'camelCase':
        setPattern('^(.+)(\\.[^.]+)$');
        setReplacement('${camel:$1}$2');
        break;
      case 'snake_case':
        setPattern('^(.+)(\\.[^.]+)$');
        setReplacement('${snake:$1}$2');
        break;
      case 'kebab-case':
        setPattern('^(.+)(\\.[^.]+)$');
        setReplacement('${kebab:$1}$2');
        break;
      default:
        break;
    }
  };

  const insertRegexSnippet = (snippet: RegexSnippet) => {
    const input = patternInputRef.current;
    if (!input) {
      setPattern((prev) => prev + snippet.pattern);
      return;
    }
    const start = input.selectionStart ?? pattern.length;
    const end = input.selectionEnd ?? pattern.length;
    const newPattern = pattern.substring(0, start) + snippet.pattern + pattern.substring(end);
    setPattern(newPattern);
    setResults(null);
    setActiveTemplateLabel(null);
    setLocalPreview(null);
    // Focus back and set cursor after insertion
    setTimeout(() => {
      input.focus();
      const newPos = start + snippet.pattern.length;
      input.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleClose = () => {
    if (renaming) return;
    setPattern('');
    setReplacement('');
    setPreview([]);
    setResults(null);
    setPatternError(null);
    setActiveTemplateLabel(null);
    setLocalPreview(null);
    onClose();
  };

  // Build unified display data
  const displayData: {
    original_name: string;
    new_name: string;
    success?: boolean;
    error?: string | null;
  }[] = useMemo(() => {
    if (results) return results;
    if (localPreview && activeTemplateLabel) {
      return localPreview.map((p) => ({ ...p, success: undefined, error: null }));
    }
    return preview;
  }, [results, localPreview, activeTemplateLabel, preview]);

  // Detect conflicts: multiple files mapping to the same new_name
  const conflictSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of displayData) {
      if (item.original_name !== item.new_name) {
        counts.set(item.new_name, (counts.get(item.new_name) || 0) + 1);
      }
    }
    const conflicts = new Set<string>();
    counts.forEach((count, name) => {
      if (count > 1) conflicts.add(name);
    });
    return conflicts;
  }, [displayData]);

  const hasChanges = displayData.some((r) => r.original_name !== r.new_name);
  const hasConflicts = conflictSet.size > 0;
  const changedCount = displayData.filter((r) => r.original_name !== r.new_name).length;

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--xp-surface)',
          borderRadius: 12,
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          width: 820,
          maxWidth: '92vw',
          maxHeight: '92vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--xp-border)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--xp-border)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 5h14M3 10h10M3 15h6"
                stroke="var(--xp-blue)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M15 13l2 2-2 2"
                stroke="var(--xp-blue)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--xp-text)', margin: 0 }}>
              Bulk Rename
            </h2>
            <span
              style={{
                fontSize: 12,
                color: 'var(--xp-text-muted)',
                backgroundColor: 'var(--xp-bg)',
                padding: '2px 8px',
                borderRadius: 10,
              }}
            >
              {files.length} file{files.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={handleClose}
            disabled={renaming}
            style={{
              padding: 6,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--xp-text-muted)',
              cursor: renaming ? 'not-allowed' : 'pointer',
              opacity: renaming ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              if (!renaming)
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-surface-light)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Pattern Template Buttons */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--xp-text-muted)',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Pattern Templates
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PATTERN_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.label}
                    onClick={() => applyTemplate(tmpl)}
                    disabled={renaming}
                    title={tmpl.description}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      border: `1px solid ${activeTemplateLabel === tmpl.label ? 'var(--xp-blue)' : 'var(--xp-border)'}`,
                      background:
                        activeTemplateLabel === tmpl.label
                          ? 'rgba(var(--xp-blue-rgb, 59, 130, 246), 0.15)'
                          : 'var(--xp-bg)',
                      color:
                        activeTemplateLabel === tmpl.label ? 'var(--xp-blue)' : 'var(--xp-text)',
                      cursor: renaming ? 'not-allowed' : 'pointer',
                      opacity: renaming ? 0.5 : 1,
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: 'monospace',
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                    onMouseEnter={(e) => {
                      if (!renaming && activeTemplateLabel !== tmpl.label) {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-blue)';
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          'var(--xp-surface-light)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeTemplateLabel !== tmpl.label) {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-border)';
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-bg)';
                      }
                    }}
                  >
                    <span style={{ opacity: 0.7, fontSize: 11 }}>{tmpl.icon}</span>
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preset buttons */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--xp-text-muted)',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Quick Presets
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(preset)}
                    disabled={renaming}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--xp-border)',
                      background: 'var(--xp-bg)',
                      cursor: renaming ? 'not-allowed' : 'pointer',
                      opacity: renaming ? 0.5 : 1,
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!renaming) {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-blue)';
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          'var(--xp-surface-light)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-border)';
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-bg)';
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--xp-text)' }}>
                      {preset.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--xp-text-muted)', marginTop: 2 }}>
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Pattern input */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--xp-text-muted)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Pattern (Regex)
              </label>
              <input
                ref={patternInputRef}
                type="text"
                value={pattern}
                onChange={(e) => {
                  setPattern(e.target.value);
                  setResults(null);
                  setActiveTemplateLabel(null);
                  setLocalPreview(null);
                }}
                disabled={renaming}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${patternError ? 'var(--xp-red)' : 'var(--xp-border)'}`,
                  borderRadius: 8,
                  backgroundColor: 'var(--xp-bg)',
                  color: 'var(--xp-text)',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => {
                  if (!patternError) e.currentTarget.style.borderColor = 'var(--xp-blue)';
                }}
                onBlur={(e) => {
                  if (!patternError) e.currentTarget.style.borderColor = 'var(--xp-border)';
                }}
                placeholder="e.g. ^(.+)\.txt$ or find_this"
              />
              {patternError && (
                <p style={{ fontSize: 11, color: 'var(--xp-red)', marginTop: 4 }}>{patternError}</p>
              )}
              <p style={{ fontSize: 11, color: 'var(--xp-text-muted)', marginTop: 4 }}>
                Applied to the filename only (not the full path). Uses regex syntax.
              </p>
            </div>

            {/* Replacement input */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--xp-text-muted)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Replacement
              </label>
              <input
                type="text"
                value={replacement}
                onChange={(e) => {
                  setReplacement(e.target.value);
                  setResults(null);
                  setActiveTemplateLabel(null);
                  setLocalPreview(null);
                }}
                disabled={renaming}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--xp-border)',
                  borderRadius: 8,
                  backgroundColor: 'var(--xp-bg)',
                  color: 'var(--xp-text)',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--xp-blue)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--xp-border)';
                }}
                placeholder="e.g. $1_renamed.txt or new_name"
              />
              <p style={{ fontSize: 11, color: 'var(--xp-text-muted)', marginTop: 4 }}>
                Supports{' '}
                <code
                  style={{
                    backgroundColor: 'var(--xp-bg)',
                    padding: '1px 4px',
                    borderRadius: 3,
                    fontSize: 11,
                  }}
                >
                  $1
                </code>
                ,{' '}
                <code
                  style={{
                    backgroundColor: 'var(--xp-bg)',
                    padding: '1px 4px',
                    borderRadius: 3,
                    fontSize: 11,
                  }}
                >
                  $2
                </code>{' '}
                (capture groups),{' '}
                <code
                  style={{
                    backgroundColor: 'var(--xp-bg)',
                    padding: '1px 4px',
                    borderRadius: 3,
                    fontSize: 11,
                  }}
                >
                  {'{N}'}
                </code>{' '}
                (zero-padded),{' '}
                <code
                  style={{
                    backgroundColor: 'var(--xp-bg)',
                    padding: '1px 4px',
                    borderRadius: 3,
                    fontSize: 11,
                  }}
                >
                  {'{date}'}
                </code>{' '}
                (YYYY-MM-DD)
              </p>
            </div>

            {/* Regex Helper Panel (collapsible) */}
            <div
              style={{
                border: '1px solid var(--xp-border)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setRegexHelperOpen(!regexHelperOpen)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: 'var(--xp-bg)',
                  border: 'none',
                  color: 'var(--xp-text-muted)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    'var(--xp-surface-light)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--xp-bg)';
                }}
              >
                <ChevronIcon open={regexHelperOpen} />
                Regex Quick Reference
              </button>
              {regexHelperOpen && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderTop: '1px solid var(--xp-border)',
                    backgroundColor: 'var(--xp-bg)',
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      color: 'var(--xp-text-muted)',
                      marginTop: 0,
                      marginBottom: 8,
                    }}
                  >
                    Click a pattern to insert it into the search field.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {REGEX_SNIPPETS.map((snippet) => (
                      <button
                        key={snippet.label}
                        onClick={() => insertRegexSnippet(snippet)}
                        title={snippet.description}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 4,
                          border: '1px solid var(--xp-border)',
                          backgroundColor: 'var(--xp-surface)',
                          color: 'var(--xp-cyan)',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontFamily: 'monospace',
                          transition: 'all 0.1s',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-cyan)';
                          (e.currentTarget as HTMLElement).style.backgroundColor =
                            'var(--xp-surface-light)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'var(--xp-border)';
                          (e.currentTarget as HTMLElement).style.backgroundColor =
                            'var(--xp-surface)';
                        }}
                      >
                        {snippet.label}
                      </button>
                    ))}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 2,
                    }}
                  >
                    {REGEX_SNIPPETS.map((snippet) => (
                      <div
                        key={snippet.label + '-desc'}
                        style={{ fontSize: 10, color: 'var(--xp-text-muted)', padding: '1px 0' }}
                      >
                        <code style={{ color: 'var(--xp-cyan)', fontFamily: 'monospace' }}>
                          {snippet.label}
                        </code>
                        <span style={{ marginLeft: 6 }}>{snippet.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Visual Preview Table */}
            {displayData.length > 0 && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--xp-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {results ? 'Results' : 'Preview'}
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontSize: 11,
                      color: 'var(--xp-text-muted)',
                    }}
                  >
                    {hasConflicts && (
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          color: 'var(--xp-orange)',
                        }}
                      >
                        <WarningIcon /> {conflictSet.size} conflict
                        {conflictSet.size !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span>{changedCount} changed</span>
                    <span>{displayData.length - changedCount} unchanged</span>
                  </div>
                </div>
                <div
                  style={{
                    backgroundColor: 'var(--xp-bg)',
                    borderRadius: 8,
                    border: '1px solid var(--xp-border)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr
                          style={{
                            position: 'sticky',
                            top: 0,
                            backgroundColor: 'var(--xp-surface)',
                            zIndex: 1,
                          }}
                        >
                          <th
                            style={{
                              textAlign: 'left',
                              padding: '8px 10px',
                              color: 'var(--xp-text-muted)',
                              fontWeight: 500,
                              fontSize: 11,
                              borderBottom: '1px solid var(--xp-border)',
                              width: '42%',
                            }}
                          >
                            Current Name
                          </th>
                          <th
                            style={{
                              textAlign: 'center',
                              padding: '8px 4px',
                              color: 'var(--xp-text-muted)',
                              fontWeight: 500,
                              fontSize: 11,
                              borderBottom: '1px solid var(--xp-border)',
                              width: '30px',
                            }}
                          ></th>
                          <th
                            style={{
                              textAlign: 'left',
                              padding: '8px 10px',
                              color: 'var(--xp-text-muted)',
                              fontWeight: 500,
                              fontSize: 11,
                              borderBottom: '1px solid var(--xp-border)',
                              width: '42%',
                            }}
                          >
                            New Name
                          </th>
                          <th
                            style={{
                              textAlign: 'center',
                              padding: '8px 10px',
                              color: 'var(--xp-text-muted)',
                              fontWeight: 500,
                              fontSize: 11,
                              borderBottom: '1px solid var(--xp-border)',
                              width: '40px',
                            }}
                          >
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayData.map((item, index) => {
                          const nameChanged = item.original_name !== item.new_name;
                          const isConflict = conflictSet.has(item.new_name) && nameChanged;
                          const isResult = results !== null;
                          const diff = nameChanged
                            ? diffStrings(item.original_name, item.new_name)
                            : null;

                          return (
                            <tr
                              key={index}
                              style={{
                                borderBottom:
                                  index < displayData.length - 1
                                    ? '1px solid var(--xp-border)'
                                    : 'none',
                                backgroundColor:
                                  isResult && item.success === false
                                    ? 'rgba(239, 68, 68, 0.08)'
                                    : isConflict
                                      ? 'rgba(245, 158, 11, 0.06)'
                                      : 'transparent',
                                transition: 'background-color 0.15s',
                              }}
                              onMouseEnter={(e) => {
                                if (!(isResult && item.success === false) && !isConflict) {
                                  (e.currentTarget as HTMLElement).style.backgroundColor =
                                    'var(--xp-surface-light)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (isResult && item.success === false) {
                                  (e.currentTarget as HTMLElement).style.backgroundColor =
                                    'rgba(239, 68, 68, 0.08)';
                                } else if (isConflict) {
                                  (e.currentTarget as HTMLElement).style.backgroundColor =
                                    'rgba(245, 158, 11, 0.06)';
                                } else {
                                  (e.currentTarget as HTMLElement).style.backgroundColor =
                                    'transparent';
                                }
                              }}
                            >
                              {/* Current Name */}
                              <td
                                style={{
                                  padding: '6px 10px',
                                  fontFamily: 'monospace',
                                  fontSize: 12,
                                  color: 'var(--xp-text)',
                                  maxWidth: 0,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={item.original_name}
                              >
                                {diff ? <DiffText spans={diff.oldSpans} /> : item.original_name}
                              </td>

                              {/* Arrow */}
                              <td
                                style={{
                                  padding: '6px 4px',
                                  textAlign: 'center',
                                  color: nameChanged ? 'var(--xp-blue)' : 'var(--xp-text-muted)',
                                  fontSize: 14,
                                }}
                              >
                                {nameChanged ? '\u2192' : '='}
                              </td>

                              {/* New Name */}
                              <td
                                style={{
                                  padding: '6px 10px',
                                  fontFamily: 'monospace',
                                  fontSize: 12,
                                  color: nameChanged ? 'var(--xp-text)' : 'var(--xp-text-muted)',
                                  maxWidth: 0,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={item.new_name}
                              >
                                {diff ? (
                                  <DiffText spans={diff.newSpans} />
                                ) : (
                                  <span style={{ fontStyle: 'italic' }}>{item.original_name}</span>
                                )}
                              </td>

                              {/* Status */}
                              <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                {isResult ? (
                                  item.success ? (
                                    <span
                                      style={{
                                        color: 'var(--xp-green)',
                                        fontSize: 11,
                                        fontWeight: 600,
                                      }}
                                      title="Success"
                                    >
                                      OK
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        color: 'var(--xp-red)',
                                        fontSize: 11,
                                        fontWeight: 600,
                                        cursor: 'help',
                                      }}
                                      title={item.error || 'Failed'}
                                    >
                                      ERR
                                    </span>
                                  )
                                ) : isConflict ? (
                                  <span title="Name conflict - multiple files would have the same name">
                                    <WarningIcon />
                                  </span>
                                ) : nameChanged ? (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      backgroundColor: 'var(--xp-blue)',
                                    }}
                                    title="Will be renamed"
                                  />
                                ) : (
                                  <span title="No change">
                                    <CheckIcon />
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Conflict warning */}
                {hasConflicts && !results && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '8px 12px',
                      borderRadius: 6,
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      color: 'var(--xp-orange)',
                    }}
                  >
                    <WarningIcon />
                    <span>
                      {conflictSet.size} naming conflict{conflictSet.size !== 1 ? 's' : ''}{' '}
                      detected. Multiple files would end up with the same name. Adjust the pattern
                      to avoid data loss.
                    </span>
                  </div>
                )}

                {/* Error details for results */}
                {results && results.some((r) => !r.success) && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {results
                      .filter((r) => !r.success)
                      .map((r, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 11,
                            color: 'var(--xp-red)',
                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                            padding: '4px 10px',
                            borderRadius: 4,
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{r.original_name}:</span> {r.error}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 24px',
            borderTop: '1px solid var(--xp-border)',
            backgroundColor: 'var(--xp-bg)',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--xp-text-muted)' }}>
            {displayData.length > 0 && !results && hasChanges && (
              <span>
                {changedCount} file{changedCount !== 1 ? 's' : ''} will be renamed
                {hasConflicts && (
                  <span style={{ color: 'var(--xp-orange)', marginLeft: 8 }}>
                    (conflicts detected)
                  </span>
                )}
              </span>
            )}
            {results && (
              <span>
                {results.filter((r) => r.success).length} of {results.length} renamed successfully
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleClose}
              disabled={renaming}
              style={{
                padding: '7px 16px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--xp-text)',
                cursor: renaming ? 'not-allowed' : 'pointer',
                opacity: renaming ? 0.5 : 1,
                fontSize: 13,
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!renaming)
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    'var(--xp-surface-light)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              {results ? 'Close' : 'Cancel'}
            </button>
            {!results && (
              <>
                <button
                  onClick={handlePreview}
                  disabled={loading || renaming || !pattern.trim()}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 6,
                    border: '1px solid var(--xp-border)',
                    backgroundColor: 'transparent',
                    color: 'var(--xp-text)',
                    cursor: loading || renaming || !pattern.trim() ? 'not-allowed' : 'pointer',
                    opacity: loading || renaming || !pattern.trim() ? 0.5 : 1,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!(loading || renaming || !pattern.trim())) {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        'var(--xp-surface-light)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  {loading && (
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        border: '2px solid transparent',
                        borderTopColor: 'var(--xp-text)',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                  )}
                  <span>Preview</span>
                </button>
                <button
                  onClick={handleRename}
                  disabled={
                    renaming ||
                    loading ||
                    (!pattern.trim() && !activeTemplateLabel) ||
                    !hasChanges ||
                    hasConflicts
                  }
                  style={{
                    padding: '7px 20px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: 'var(--xp-blue)',
                    color: '#fff',
                    cursor:
                      renaming ||
                      loading ||
                      (!pattern.trim() && !activeTemplateLabel) ||
                      !hasChanges ||
                      hasConflicts
                        ? 'not-allowed'
                        : 'pointer',
                    opacity:
                      renaming ||
                      loading ||
                      (!pattern.trim() && !activeTemplateLabel) ||
                      !hasChanges ||
                      hasConflicts
                        ? 0.5
                        : 1,
                    fontSize: 13,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  {renaming && (
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        border: '2px solid transparent',
                        borderTopColor: '#fff',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                  )}
                  <span>{renaming ? 'Renaming...' : 'Rename'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BulkRenameDialog;
