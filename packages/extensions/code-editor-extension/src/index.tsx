/**
 * Xplorer Code Editor Extension
 *
 * A syntax-highlighted code editor powered by CodeMirror 6.
 * Registers via Editor.register() to provide the default editor for text/code files.
 * Renders in the main content pane when editor tabs are opened.
 */

import React from 'react';
import { Editor, type XplorerAPI } from '@xplorer/extension-sdk';
import { basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { markdown } from '@codemirror/lang-markdown';
import { rust } from '@codemirror/lang-rust';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { xml } from '@codemirror/lang-xml';
import { sql } from '@codemirror/lang-sql';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFileExtension(filePath: string): string {
  return (filePath.split('.').pop() || '').toLowerCase();
}

function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || 'Untitled';
}

function getLanguageName(filePath: string): string {
  const ext = getFileExtension(filePath);
  const map: Record<string, string> = {
    js: 'JavaScript', jsx: 'JavaScript JSX', ts: 'TypeScript', tsx: 'TypeScript JSX',
    py: 'Python', rb: 'Ruby', rs: 'Rust', go: 'Go', java: 'Java',
    c: 'C', cpp: 'C++', h: 'C Header', hpp: 'C++ Header', cs: 'C#',
    swift: 'Swift', kt: 'Kotlin', lua: 'Lua', r: 'R', sql: 'SQL',
    sh: 'Shell', bash: 'Shell', zsh: 'Shell', ps1: 'PowerShell', bat: 'Batch',
    html: 'HTML', css: 'CSS', scss: 'SCSS', xml: 'XML', svg: 'SVG',
    json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML',
    md: 'Markdown', txt: 'Plain Text', ini: 'INI', cfg: 'Config',
    graphql: 'GraphQL', proto: 'Protobuf',
  };
  return map[ext] || 'Plain Text';
}

function getLanguageExtension(filePath: string) {
  const ext = getFileExtension(filePath);
  switch (ext) {
    case 'js': case 'jsx': return javascript({ jsx: true });
    case 'ts': return javascript({ typescript: true });
    case 'tsx': return javascript({ jsx: true, typescript: true });
    case 'html': case 'htm': case 'svg': return html();
    case 'css': case 'scss': case 'less': return css();
    case 'json': return json();
    case 'py': return python();
    case 'md': case 'markdown': return markdown();
    case 'rs': return rust();
    case 'c': case 'h': case 'cpp': case 'hpp': case 'cc': case 'cxx': return cpp();
    case 'java': return java();
    case 'xml': case 'xsl': case 'xslt': return xml();
    case 'sql': return sql();
    default: return [];
  }
}

// ── CodeMirror Theme (CSS variable-based) ────────────────────────────────────

const xplorerTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--xp-bg)',
    color: 'var(--xp-text)',
    height: '100%',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--xp-surface)',
    color: 'var(--xp-text-muted)',
    border: 'none',
    borderRight: '1px solid var(--xp-border)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--xp-surface-light)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--xp-surface-light)',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: 'var(--xp-text)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(122, 162, 247, 0.2)',
  },
  '.cm-content': {
    caretColor: 'var(--xp-text)',
    fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
  },
  '.cm-line': {
    padding: '0 4px',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--xp-surface-light)',
    border: 'none',
    color: 'var(--xp-text-muted)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--xp-surface)',
    border: '1px solid var(--xp-border)',
    color: 'var(--xp-text)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--xp-surface)',
    color: 'var(--xp-text)',
  },
  '.cm-panel.cm-search': {
    backgroundColor: 'var(--xp-surface)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(224, 175, 104, 0.3)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(224, 175, 104, 0.5)',
  },
});

// ── Syntax Highlighting (fixed colors for dark themes) ───────────────────────

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#bb9af7' },
  { tag: tags.operator, color: '#89ddff' },
  { tag: tags.variableName, color: '#c0caf5' },
  { tag: tags.function(tags.variableName), color: '#7aa2f7' },
  { tag: tags.string, color: '#9ece6a' },
  { tag: tags.number, color: '#ff9e64' },
  { tag: tags.bool, color: '#ff9e64' },
  { tag: tags.comment, color: '#565f89', fontStyle: 'italic' },
  { tag: tags.typeName, color: '#2ac3de' },
  { tag: tags.className, color: '#2ac3de' },
  { tag: tags.propertyName, color: '#73daca' },
  { tag: tags.tagName, color: '#f7768e' },
  { tag: tags.attributeName, color: '#bb9af7' },
  { tag: tags.punctuation, color: '#89ddff' },
  { tag: tags.definition(tags.variableName), color: '#c0caf5' },
  { tag: tags.special(tags.variableName), color: '#7dcfff' },
  { tag: tags.regexp, color: '#b4f9f8' },
  { tag: tags.meta, color: '#565f89' },
  { tag: tags.heading, color: '#89ddff', fontWeight: 'bold' },
  { tag: tags.link, color: '#7aa2f7', textDecoration: 'underline' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
]);

// ── CodeMirrorEditor Component ───────────────────────────────────────────────

function CodeMirrorEditor(props: { filePath: string; api: XplorerAPI }) {
  const { filePath, api } = props;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const languageComp = React.useRef(new Compartment());
  const wrapComp = React.useRef(new Compartment());
  const originalContentRef = React.useRef('');
  const saveInProgressRef = React.useRef(false);

  const [dirty, setDirty] = React.useState(false);
  const [cursorLine, setCursorLine] = React.useState(1);
  const [cursorCol, setCursorCol] = React.useState(1);
  const [lineCount, setLineCount] = React.useState(0);
  const [wordWrap, setWordWrap] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Save function
  const save = React.useCallback(async () => {
    const view = viewRef.current;
    if (!view || saveInProgressRef.current) return;
    saveInProgressRef.current = true;
    try {
      const content = view.state.doc.toString();
      await api.files.write(filePath, content);
      originalContentRef.current = content;
      setDirty(false);
    } catch (err: any) {
      api.ui.showMessage(`Failed to save: ${err?.message || err}`, 'error');
    } finally {
      saveInProgressRef.current = false;
    }
  }, [filePath, api]);

  // Revert function
  const revert = React.useCallback(async () => {
    const view = viewRef.current;
    if (!view) return;
    try {
      const content = await api.files.readText(filePath);
      originalContentRef.current = content;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
      setDirty(false);
    } catch (err: any) {
      api.ui.showMessage(`Failed to revert: ${err?.message || err}`, 'error');
    }
  }, [filePath, api]);

  // Copy file content to clipboard
  const copyContent = React.useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const content = view.state.doc.toString();
    navigator.clipboard.writeText(content).catch(() => {
      api.ui.showMessage('Failed to copy to clipboard', 'error');
    });
  }, [api]);

  // Toggle word wrap
  const toggleWordWrap = React.useCallback(() => {
    setWordWrap(prev => {
      const next = !prev;
      const view = viewRef.current;
      if (view) {
        view.dispatch({
          effects: wrapComp.current.reconfigure(next ? EditorView.lineWrapping : []),
        });
      }
      return next;
    });
  }, []);

  // Keep save ref current for the keymap
  const saveRef = React.useRef(save);
  saveRef.current = save;

  // Create / recreate editor when filePath changes
  React.useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;

    setLoading(true);
    setError(null);
    setDirty(false);
    setCursorLine(1);
    setCursorCol(1);

    // Destroy previous view
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    // Create new compartments for this view instance
    const langComp = new Compartment();
    const wrapC = new Compartment();
    languageComp.current = langComp;
    wrapComp.current = wrapC;

    api.files.readText(filePath).then(content => {
      if (destroyed || !containerRef.current) return;

      originalContentRef.current = content;
      setLineCount(content.split('\n').length);
      setLoading(false);

      const state = EditorState.create({
        doc: content,
        extensions: [
          basicSetup,
          xplorerTheme,
          syntaxHighlighting(highlightStyle),
          langComp.of(getLanguageExtension(filePath)),
          wrapC.of(wordWrap ? EditorView.lineWrapping : []),
          keymap.of([
            indentWithTab,
            {
              key: 'Mod-s',
              run: () => {
                saveRef.current();
                return true;
              },
            },
          ]),
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              const newContent = update.state.doc.toString();
              setDirty(newContent !== originalContentRef.current);
              setLineCount(update.state.doc.lines);
            }
            if (update.selectionSet || update.docChanged) {
              const pos = update.state.selection.main.head;
              const line = update.state.doc.lineAt(pos);
              setCursorLine(line.number);
              setCursorCol(pos - line.from + 1);
            }
          }),
        ],
      });

      const view = new EditorView({ state, parent: containerRef.current! });
      viewRef.current = view;

      requestAnimationFrame(() => {
        if (!destroyed) view.focus();
      });
    }).catch(err => {
      if (!destroyed) {
        setLoading(false);
        setError(err?.message || 'Failed to load file');
      }
    });

    return () => {
      destroyed = true;
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [filePath]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────────────────

  const fileName = getFileName(filePath);
  const langName = getLanguageName(filePath);

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--xp-text-muted)',
        backgroundColor: 'var(--xp-bg)', fontFamily: 'sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#f7768e', marginBottom: 8 }}>Failed to open file</div>
          <div style={{ fontSize: 12, color: 'var(--xp-text-muted)' }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      backgroundColor: 'var(--xp-bg)', color: 'var(--xp-text)',
      fontFamily: 'sans-serif', overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 12px', minHeight: 36,
        backgroundColor: 'var(--xp-surface)',
        borderBottom: '1px solid var(--xp-border)',
        fontSize: 12, flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, color: 'var(--xp-text)', marginRight: 4 }}>
          {fileName}
        </span>
        {dirty && (
          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 4,
            backgroundColor: 'rgba(255, 158, 100, 0.2)', color: '#ff9e64',
            fontWeight: 600,
          }}>
            Modified
          </span>
        )}

        <div style={{ flex: 1 }} />

        <button
          onClick={toggleWordWrap}
          title="Toggle Word Wrap"
          style={{
            padding: '3px 8px', fontSize: 11, cursor: 'pointer',
            border: '1px solid var(--xp-border)', borderRadius: 4,
            backgroundColor: wordWrap ? 'rgba(122, 162, 247, 0.2)' : 'transparent',
            color: wordWrap ? '#7aa2f7' : 'var(--xp-text-muted)',
          }}
        >
          Wrap
        </button>
        <button
          onClick={copyContent}
          title="Copy file content"
          style={{
            padding: '3px 8px', fontSize: 11, cursor: 'pointer',
            border: '1px solid var(--xp-border)', borderRadius: 4,
            backgroundColor: 'transparent', color: 'var(--xp-text-muted)',
          }}
        >
          Copy
        </button>
        <button
          onClick={revert}
          title="Revert to last saved"
          disabled={!dirty}
          style={{
            padding: '3px 8px', fontSize: 11, cursor: dirty ? 'pointer' : 'default',
            border: '1px solid var(--xp-border)', borderRadius: 4,
            backgroundColor: 'transparent',
            color: dirty ? 'var(--xp-text-muted)' : 'var(--xp-border)',
            opacity: dirty ? 1 : 0.5,
          }}
        >
          Revert
        </button>
        <button
          onClick={save}
          title="Save (Ctrl+S)"
          disabled={!dirty}
          style={{
            padding: '3px 10px', fontSize: 11, cursor: dirty ? 'pointer' : 'default',
            border: 'none', borderRadius: 4,
            backgroundColor: dirty ? '#7aa2f7' : 'var(--xp-surface-light)',
            color: dirty ? '#fff' : 'var(--xp-text-muted)',
            fontWeight: 600,
          }}
        >
          Save
        </button>
      </div>

      {/* Editor area */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--xp-bg)', color: 'var(--xp-text-muted)',
            fontSize: 13, zIndex: 1,
          }}>
            Loading...
          </div>
        )}
        <div ref={containerRef} style={{ height: '100%', overflow: 'auto' }} />
      </div>

      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '2px 12px', minHeight: 24,
        backgroundColor: 'var(--xp-surface)',
        borderTop: '1px solid var(--xp-border)',
        fontSize: 11, color: 'var(--xp-text-muted)',
        flexShrink: 0,
      }}>
        <span>Ln {cursorLine}, Col {cursorCol}</span>
        <span>{langName}</span>
        <span>{lineCount} lines</span>
      </div>
    </div>
  );
}

// ── Register Editor ──────────────────────────────────────────────────────────

let api: XplorerAPI;

Editor.register({
  id: 'code-editor',
  title: 'Code Editor',
  extensions: [
    'ts', 'tsx', 'js', 'jsx', 'json', 'py', 'rs', 'go', 'java', 'c', 'cpp',
    'h', 'hpp', 'cs', 'html', 'css', 'scss', 'md', 'yaml', 'yml', 'toml',
    'xml', 'sql', 'sh', 'bash', 'lua', 'rb', 'php', 'svg', 'txt', 'log',
    'env', 'gitignore', 'dockerfile', 'makefile', 'ini', 'cfg', 'conf',
    'graphql', 'proto', 'vim', 'cmake', 'gradle', 'properties', 'csv', 'tsv',
  ],
  priority: 20,
  permissions: ['file:read', 'file:write'],
  render: ({ filePath }) => React.createElement(CodeMirrorEditor, { filePath, api }),
  onActivate: (injectedApi) => { api = injectedApi; },
});
