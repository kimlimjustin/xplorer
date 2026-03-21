import { useState, useEffect, useCallback, useRef } from 'react';
import { transport } from '@/lib/transport';
import { TauriAPI } from '@/lib/tauri-api';
import { getFileExtension } from '@/lib/editable-files';
import { Save, RotateCcw, WrapText, Copy, Check } from 'lucide-react';
import { COPY_FEEDBACK_MS } from '@/lib/constants';

interface FileEditorViewProps {
  filePath: string;
}

const FileEditorView = ({ filePath }: FileEditorViewProps) => {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wordWrap, setWordWrap] = useState(true);
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = content !== originalContent;
  const fileName = filePath.split(/[\\/]/).pop() || filePath;
  const ext = getFileExtension(fileName).toUpperCase() || 'TEXT';
  const lineCount = content.split('\n').length;

  // Clean up copy feedback timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Load file
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    TauriAPI.readTextFile(filePath)
      .then((text) => {
        if (cancelled) return;
        setContent(text);
        setOriginalContent(text);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(`Failed to read file: ${err}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    setSaving(true);
    try {
      await transport('agent_write_file_with_permission', {
        filePath,
        content,
        permissionGranted: true,
      });
      setOriginalContent(content);
    } catch (err) {
      setError(`Failed to save: ${err}`);
    } finally {
      setSaving(false);
    }
  }, [filePath, content, isDirty]);

  const handleRevert = useCallback(() => {
    setContent(originalContent);
  }, [originalContent]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // fallback
    }
  }, [content]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = `${content.substring(0, start)}  ${content.substring(end)}`;
        setContent(newContent);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    },
    [content, handleSave],
  );

  // Global Ctrl+S when editor is mounted (even if textarea not focused)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  // Emit cursor position to the global StatusBar via custom event
  const emitCursorPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, pos);
    const line = (textBefore.match(/\n/g) || []).length + 1;
    const lastNewline = textBefore.lastIndexOf('\n');
    const column = lastNewline === -1 ? pos + 1 : pos - lastNewline;
    window.dispatchEvent(
      new CustomEvent('editor-cursor-change', {
        detail: { line, column },
      }),
    );
  }, []);

  // Emit initial cursor position once content is loaded
  useEffect(() => {
    if (!loading && content) {
      // Small delay to ensure textarea has rendered with content
      requestAnimationFrame(() => emitCursorPosition());
    }
  }, [loading, content, emitCursorPosition]);

  // Sync line numbers scroll with textarea
  const handleScroll = useCallback(() => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  if (loading) {
    return (
      <div className="text-xp-text-muted flex h-full items-center justify-center text-sm">
        Loading...
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="text-xp-text-muted flex h-full items-center justify-center px-4 text-center text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-xp-bg flex h-full flex-col">
      {/* Toolbar */}
      <div className="border-xp-border bg-xp-surface flex flex-shrink-0 items-center justify-between border-b px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xp-text truncate text-sm font-medium" title={filePath}>
            {fileName}
          </span>
          {isDirty && (
            <span className="text-xp-orange bg-xp-orange/10 rounded px-1.5 py-0.5 text-xs font-medium">
              Modified
            </span>
          )}
          {saving && <span className="text-xp-text-muted text-xs">Saving...</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text rounded p-1.5 transition-colors"
            title="Copy contents"
          >
            {copied ? <Check size={15} className="text-xp-green" /> : <Copy size={15} />}
          </button>
          <button
            onClick={() => setWordWrap(!wordWrap)}
            className={`hover:bg-xp-surface-light rounded p-1.5 transition-colors ${
              wordWrap ? 'text-xp-blue' : 'text-xp-text-muted hover:text-xp-text'
            }`}
            title="Toggle word wrap"
          >
            <WrapText size={15} />
          </button>
          <button
            onClick={handleRevert}
            disabled={!isDirty}
            className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text rounded p-1.5 transition-colors disabled:opacity-30"
            title="Revert changes"
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-blue rounded p-1.5 transition-colors disabled:opacity-30"
            title="Save (Ctrl+S)"
          >
            <Save size={15} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-xp-red/10 text-xp-red flex-shrink-0 px-4 py-1.5 text-xs">{error}</div>
      )}

      {/* Editor area */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          className="bg-xp-surface/50 border-xp-border flex-shrink-0 select-none overflow-hidden border-r px-3 py-3"
        >
          <div className="text-xp-text-muted text-right font-mono text-sm leading-[1.5rem]">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            requestAnimationFrame(emitCursorPosition);
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={emitCursorPosition}
          onClick={emitCursorPosition}
          onSelect={emitCursorPosition}
          onScroll={handleScroll}
          spellCheck={false}
          className={`text-xp-text flex-1 resize-none bg-transparent p-3 font-mono text-sm leading-[1.5rem] outline-none ${
            wordWrap ? 'whitespace-pre-wrap break-words' : 'overflow-x-auto whitespace-pre'
          }`}
          style={{ tabSize: 2 }}
        />
      </div>

      {/* Status bar */}
      <div className="border-xp-border text-xp-text-muted bg-xp-surface flex flex-shrink-0 items-center justify-between border-t px-4 py-1.5 text-xs">
        <span>{lineCount} lines</span>
        <span>{ext}</span>
      </div>
    </div>
  );
};

export default FileEditorView;
