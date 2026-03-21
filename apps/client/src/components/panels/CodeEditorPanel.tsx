import React, { useState, useEffect, useCallback, useRef } from 'react';
import { transport } from '@/lib/transport';
import { TauriAPI, type FileEntry } from '@/lib/tauri-api';
import { Save, RotateCcw, WrapText, Copy, Check } from 'lucide-react';
import { COPY_FEEDBACK_MS } from '@/lib/constants';
import { getFileExtension, isEditableFile as isEditable } from '@/lib/editable-files';

interface CodeEditorPanelProps {
  selectedFile?: FileEntry | null;
}

const CodeEditorPanel = ({ selectedFile }: CodeEditorPanelProps) => {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wordWrap, setWordWrap] = useState(true);
  const [copied, setCopied] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up copy feedback timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const isDirty = content !== originalContent;

  const loadFile = useCallback(async (file: FileEntry) => {
    if (!isEditable(file)) {
      setError('This file type cannot be edited');
      setContent('');
      setOriginalContent('');
      setCurrentFilePath(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const text = await TauriAPI.readTextFile(file.path);
      setContent(text);
      setOriginalContent(text);
      setCurrentFilePath(file.path);
    } catch (err) {
      setError(`Failed to read file: ${err}`);
      setContent('');
      setOriginalContent('');
      setCurrentFilePath(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedFile && !selectedFile.is_dir) {
      loadFile(selectedFile);
    } else {
      setContent('');
      setOriginalContent('');
      setCurrentFilePath(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.path]);

  const handleSave = async () => {
    if (!currentFilePath || !isDirty) return;
    setSaving(true);
    try {
      await transport('agent_write_file_with_permission', {
        filePath: currentFilePath,
        content,
        permissionGranted: true,
      });
      setOriginalContent(content);
    } catch (err) {
      setError(`Failed to save: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    setContent(originalContent);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // fallback
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    // Tab key inserts spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = `${content.substring(0, start)}  ${content.substring(end)}`;
      setContent(newContent);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  const lineCount = content.split('\n').length;

  // No file selected
  if (!selectedFile || selectedFile.is_dir) {
    return (
      <div className="text-xp-text-muted flex h-full items-center justify-center text-sm">
        Select a file to edit
      </div>
    );
  }

  // Error state
  if (error && !content) {
    return (
      <div className="text-xp-text-muted flex h-full items-center justify-center px-4 text-center text-sm">
        {error}
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="text-xp-text-muted flex h-full items-center justify-center text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="border-xp-border flex flex-shrink-0 items-center justify-between border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-1">
          <span className="text-xp-text truncate text-xs" title={currentFilePath || ''}>
            {selectedFile.name}
          </span>
          {isDirty && <span className="text-xp-orange ml-1 text-xs font-medium">Modified</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text rounded p-1.5 transition-colors"
            title="Copy contents"
          >
            {copied ? <Check size={14} className="text-xp-green" /> : <Copy size={14} />}
          </button>
          <button
            onClick={() => setWordWrap(!wordWrap)}
            className={`hover:bg-xp-surface-light rounded p-1.5 transition-colors ${
              wordWrap ? 'text-xp-blue' : 'text-xp-text-muted hover:text-xp-text'
            }`}
            title="Toggle word wrap"
          >
            <WrapText size={14} />
          </button>
          <button
            onClick={handleRevert}
            disabled={!isDirty}
            className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-text rounded p-1.5 transition-colors disabled:opacity-30"
            title="Revert changes"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="hover:bg-xp-surface-light text-xp-text-muted hover:text-xp-blue rounded p-1.5 transition-colors disabled:opacity-30"
            title="Save (Cmd+S)"
          >
            <Save size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-xp-red/10 text-xp-red flex-shrink-0 px-3 py-1.5 text-xs">{error}</div>
      )}

      {/* Editor area */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Line numbers */}
        <div className="bg-xp-surface/50 border-xp-border flex-shrink-0 select-none overflow-hidden border-r px-2 py-3">
          <div className="text-xp-text-muted text-right font-mono text-xs leading-[1.4rem]">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          className={`text-xp-text flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-[1.4rem] outline-none ${
            wordWrap ? 'whitespace-pre-wrap break-words' : 'overflow-x-auto whitespace-pre'
          }`}
          style={{ tabSize: 2 }}
        />
      </div>

      {/* Status bar */}
      <div className="border-xp-border text-xp-text-muted flex flex-shrink-0 items-center justify-between border-t px-3 py-1 text-[10px]">
        <span>{lineCount} lines</span>
        <span>{getFileExtension(selectedFile.name).toUpperCase() || 'TEXT'}</span>
      </div>
    </div>
  );
};

export default CodeEditorPanel;
