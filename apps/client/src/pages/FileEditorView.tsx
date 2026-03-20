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
        const newContent = content.substring(0, start) + '  ' + content.substring(end);
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
      <div className="h-full flex items-center justify-center text-xp-text-muted text-sm">
        Loading...
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="h-full flex items-center justify-center text-xp-text-muted text-sm px-4 text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-xp-bg">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-xp-border flex-shrink-0 bg-xp-surface">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-xp-text font-medium truncate" title={filePath}>
            {fileName}
          </span>
          {isDirty && (
            <span className="text-xs text-xp-orange font-medium px-1.5 py-0.5 bg-xp-orange/10 rounded">
              Modified
            </span>
          )}
          {saving && <span className="text-xs text-xp-text-muted">Saving...</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-xp-surface-light rounded text-xp-text-muted hover:text-xp-text transition-colors"
            title="Copy contents"
          >
            {copied ? <Check size={15} className="text-xp-green" /> : <Copy size={15} />}
          </button>
          <button
            onClick={() => setWordWrap(!wordWrap)}
            className={`p-1.5 hover:bg-xp-surface-light rounded transition-colors ${
              wordWrap ? 'text-xp-blue' : 'text-xp-text-muted hover:text-xp-text'
            }`}
            title="Toggle word wrap"
          >
            <WrapText size={15} />
          </button>
          <button
            onClick={handleRevert}
            disabled={!isDirty}
            className="p-1.5 hover:bg-xp-surface-light rounded text-xp-text-muted hover:text-xp-text disabled:opacity-30 transition-colors"
            title="Revert changes"
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="p-1.5 hover:bg-xp-surface-light rounded text-xp-text-muted hover:text-xp-blue disabled:opacity-30 transition-colors"
            title="Save (Ctrl+S)"
          >
            <Save size={15} />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-1.5 bg-xp-red/10 text-xp-red text-xs flex-shrink-0">{error}</div>
      )}

      {/* Editor area */}
      <div className="flex-1 overflow-hidden flex min-h-0">
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          className="flex-shrink-0 bg-xp-surface/50 border-r border-xp-border px-3 py-3 overflow-hidden select-none"
        >
          <div className="font-mono text-sm leading-[1.5rem] text-xp-text-muted text-right">
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
          className={`flex-1 bg-transparent text-xp-text font-mono text-sm leading-[1.5rem] p-3 resize-none outline-none ${
            wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-x-auto'
          }`}
          style={{ tabSize: 2 }}
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-xp-border text-xs text-xp-text-muted flex-shrink-0 bg-xp-surface">
        <span>{lineCount} lines</span>
        <span>{ext}</span>
      </div>
    </div>
  );
}

export default FileEditorView;
