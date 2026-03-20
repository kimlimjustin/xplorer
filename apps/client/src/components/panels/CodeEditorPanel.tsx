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
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
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
      <div className="h-full flex items-center justify-center text-xp-text-muted text-sm">
        Select a file to edit
      </div>
    );
  }

  // Error state
  if (error && !content) {
    return (
      <div className="h-full flex items-center justify-center text-xp-text-muted text-sm px-4 text-center">
        {error}
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-xp-text-muted text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-xp-border flex-shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-xs text-xp-text truncate" title={currentFilePath || ''}>
            {selectedFile.name}
          </span>
          {isDirty && <span className="text-xs text-xp-orange font-medium ml-1">Modified</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-xp-surface-light rounded text-xp-text-muted hover:text-xp-text transition-colors"
            title="Copy contents"
          >
            {copied ? <Check size={14} className="text-xp-green" /> : <Copy size={14} />}
          </button>
          <button
            onClick={() => setWordWrap(!wordWrap)}
            className={`p-1.5 hover:bg-xp-surface-light rounded transition-colors ${
              wordWrap ? 'text-xp-blue' : 'text-xp-text-muted hover:text-xp-text'
            }`}
            title="Toggle word wrap"
          >
            <WrapText size={14} />
          </button>
          <button
            onClick={handleRevert}
            disabled={!isDirty}
            className="p-1.5 hover:bg-xp-surface-light rounded text-xp-text-muted hover:text-xp-text disabled:opacity-30 transition-colors"
            title="Revert changes"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="p-1.5 hover:bg-xp-surface-light rounded text-xp-text-muted hover:text-xp-blue disabled:opacity-30 transition-colors"
            title="Save (Cmd+S)"
          >
            <Save size={14} />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-1.5 bg-xp-red/10 text-xp-red text-xs flex-shrink-0">{error}</div>
      )}

      {/* Editor area */}
      <div className="flex-1 overflow-hidden flex min-h-0">
        {/* Line numbers */}
        <div className="flex-shrink-0 bg-xp-surface/50 border-r border-xp-border px-2 py-3 overflow-hidden select-none">
          <div className="font-mono text-xs leading-[1.4rem] text-xp-text-muted text-right">
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
          className={`flex-1 bg-transparent text-xp-text font-mono text-xs leading-[1.4rem] p-3 resize-none outline-none ${
            wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-x-auto'
          }`}
          style={{ tabSize: 2 }}
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-xp-border text-[10px] text-xp-text-muted flex-shrink-0">
        <span>{lineCount} lines</span>
        <span>{getFileExtension(selectedFile.name).toUpperCase() || 'TEXT'}</span>
      </div>
    </div>
  );
}

export default CodeEditorPanel;
