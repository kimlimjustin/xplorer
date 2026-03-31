import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { TauriAPI, type BulkRenameResult, type FileEntry } from '@/lib/tauri-api';
import type {
  Preset,
  PatternTemplate,
  RegexSnippet,
} from '@/components/dialogs/bulk-rename-helpers';

export interface BulkRenameState {
  pattern: string;
  replacement: string;
  preview: BulkRenameResult[];
  results: BulkRenameResult[] | null;
  loading: boolean;
  renaming: boolean;
  patternError: string | null;
  regexHelperOpen: boolean;
  activeTemplateLabel: string | null;
  localPreview: { original_name: string; new_name: string }[] | null;
  patternInputRef: React.RefObject<HTMLInputElement | null>;
}

export interface BulkRenameActions {
  setPattern: (pattern: string) => void;
  setReplacement: (replacement: string) => void;
  setRegexHelperOpen: (open: boolean) => void;
  handlePreview: () => Promise<void>;
  handleRename: () => Promise<void>;
  handleClose: () => void;
  applyPreset: (preset: Preset) => void;
  applyTemplate: (template: PatternTemplate) => void;
  insertRegexSnippet: (snippet: RegexSnippet) => void;
  onPatternChange: (value: string) => void;
  onReplacementChange: (value: string) => void;
}

export interface BulkRenameDerived {
  displayData: {
    original_name: string;
    new_name: string;
    success?: boolean;
    error?: string | null;
  }[];
  conflictSet: Set<string>;
  hasChanges: boolean;
  hasConflicts: boolean;
  changedCount: number;
}

export const useBulkRename = (
  isOpen: boolean,
  files: FileEntry[],
  onClose: () => void,
  onComplete?: () => void,
): { state: BulkRenameState; actions: BulkRenameActions; derived: BulkRenameDerived } => {
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
    setActiveTemplateLabel(template.label);
    setResults(null);
    setPatternError(null);

    // Compute local preview
    const previews = files.map((f) => ({
      original_name: f.name,
      new_name: template.apply(f.name),
    }));
    setLocalPreview(previews);

    switch (template.label) {
      case 'Remove Spaces':
        setPattern('\\s+');
        setReplacement('_');
        setLocalPreview(null);
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

  const onPatternChange = (value: string) => {
    setPattern(value);
    setResults(null);
    setActiveTemplateLabel(null);
    setLocalPreview(null);
  };

  const onReplacementChange = (value: string) => {
    setReplacement(value);
    setResults(null);
    setActiveTemplateLabel(null);
    setLocalPreview(null);
  };

  // Build unified display data
  const displayData = useMemo(() => {
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

  return {
    state: {
      pattern,
      replacement,
      preview,
      results,
      loading,
      renaming,
      patternError,
      regexHelperOpen,
      activeTemplateLabel,
      localPreview,
      patternInputRef,
    },
    actions: {
      setPattern,
      setReplacement,
      setRegexHelperOpen,
      handlePreview,
      handleRename,
      handleClose,
      applyPreset,
      applyTemplate,
      insertRegexSnippet,
      onPatternChange,
      onReplacementChange,
    },
    derived: {
      displayData,
      conflictSet,
      hasChanges,
      hasConflicts,
      changedCount,
    },
  };
};
