/**
 * Xplorer Code Editor Extension — VS Code-like Editor
 *
 * A full-featured code editor that opens as a full-screen overlay.
 * Features: syntax highlighting (CodeMirror 6), file tree, multiple tabs,
 * VS Code settings import, Tokyo Night theme.
 *
 * Trigger: button in the sidebar panel or Ctrl+Shift+E shortcut.
 */

import React from 'react';
import { basicSetup } from 'codemirror';
import { EditorState, Compartment, Extension } from '@codemirror/state';
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

// ── Types ───────────────────────────────────────────────────────────────────

interface XplorerAPI {
  files: {
    readText(path: string): Promise<string>;
    read(path: string): Promise<ArrayBuffer>;
    write(path: string, content: string | ArrayBuffer): Promise<void>;
    exists(path: string): Promise<boolean>;
    list(path: string): Promise<FileEntry[]>;
  };
  ui: {
    showMessage(message: string, type: 'info' | 'warning' | 'error'): void;
  };
  navigation: {
    getCurrentPath(): string;
    navigateTo(path: string): void;
  };
  settings: {
    get<T>(key: string, defaultValue?: T): Promise<T | undefined>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
  };
  commands: {
    register(command: string, callback: (...args: unknown[]) => unknown): void;
    execute(command: string, ...args: unknown[]): Promise<unknown>;
  };
  shortcuts: {
    register(
      shortcutId: string,
      options: { key: string; title?: string; when?: string }
    ): Promise<void>;
    unregisterAll(): Promise<void>;
  };
}

interface PanelRenderProps {
  currentPath?: string;
  selectedFiles?: Set<string>;
  [key: string]: unknown;
}

interface FileEntry {
  path: string;
  name: string;
  is_dir: boolean;
}

interface OpenFile {
  path: string;
  content: string;
  originalContent: string;
  language: string;
}

interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────────

const C = {
  bg: '#1a1b26',
  bgDark: '#16161e',
  bgLight: '#1e2030',
  fg: '#a9b1d6',
  fgBright: '#c0caf5',
  fgDim: '#565f89',
  border: '#292e42',
  accent: '#7aa2f7',
  accentDim: '#3d59a1',
  green: '#9ece6a',
  yellow: '#e0af68',
  red: '#f7768e',
  purple: '#bb9af7',
  cyan: '#2ac3de',
  orange: '#ff9e64',
  selection: '#283457',
};

const DEFAULT_SETTINGS: EditorSettings = {
  fontSize: 14,
  fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
  tabSize: 2,
  wordWrap: false,
  lineNumbers: true,
};

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.css', '.scss',
  '.html', '.xml', '.svg', '.yaml', '.yml', '.toml', '.ini', '.cfg',
  '.conf', '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
  '.py', '.rb', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.swift', '.kt', '.lua', '.r', '.sql', '.graphql', '.proto',
  '.env', '.gitignore', '.dockerignore', '.editorconfig', '.prettierrc',
  '.eslintrc', '.babelrc', '.lock', '.log', '.csv', '.tsv',
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

function isTextFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const fileName = lower.split(/[/\\]/).pop() || '';
  if (['makefile', 'dockerfile', 'vagrantfile', 'rakefile', 'gemfile'].includes(fileName)) return true;
  if (TEXT_EXTENSIONS.has(fileName)) return true;
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return false;
  return TEXT_EXTENSIONS.has(fileName.slice(lastDot));
}

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

function getLanguageExtension(filePath: string): Extension {
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

function getFileIcon(name: string, isDir: boolean): string {
  if (isDir) return '\u{1F4C1}';
  const ext = getFileExtension(name);
  const icons: Record<string, string> = {
    ts: 'TS', tsx: 'TX', js: 'JS', jsx: 'JX',
    py: 'PY', rs: 'RS', go: 'GO', java: 'JA',
    html: 'HT', css: 'CS', json: 'JS', md: 'MD',
    sql: 'SQ', xml: 'XM', yml: 'YM', yaml: 'YM',
    c: 'C', cpp: 'C+', h: 'H', hpp: 'H+',
  };
  return icons[ext] || '\u{1F4C4}';
}

function getFileIconColor(name: string): string {
  const ext = getFileExtension(name);
  const colors: Record<string, string> = {
    ts: C.accent, tsx: C.accent, js: C.yellow, jsx: C.yellow,
    py: C.green, rs: C.orange, go: C.cyan, java: C.red,
    html: C.red, css: C.purple, json: C.yellow, md: C.fgBright,
    sql: C.cyan, xml: C.orange, c: C.accent, cpp: C.accent,
  };
  return colors[ext] || C.fgDim;
}

// ── CodeMirror Tokyo Night Theme ────────────────────────────────────────────

const tokyoNightTheme = EditorView.theme({
  '&': { backgroundColor: C.bg, color: C.fg },
  '.cm-content': { caretColor: C.fgBright, fontFamily: 'inherit' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: C.fgBright },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: C.selection + ' !important',
  },
  '.cm-activeLine': { backgroundColor: C.bgLight },
  '.cm-gutters': {
    backgroundColor: C.bgDark, color: C.fgDim,
    borderRight: `1px solid ${C.border}`,
  },
  '.cm-activeLineGutter': { backgroundColor: C.bgLight, color: C.fg },
  '.cm-foldPlaceholder': { backgroundColor: C.border, color: C.accent, border: 'none' },
  '.cm-tooltip': { backgroundColor: C.bgDark, border: `1px solid ${C.border}`, color: C.fg },
  '.cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': { backgroundColor: C.selection },
  },
  '.cm-searchMatch': { backgroundColor: C.accentDim, outline: `1px solid ${C.accent}` },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: C.selection },
  '.cm-panels': { backgroundColor: C.bgDark, color: C.fg },
  '.cm-panels.cm-panels-top': { borderBottom: `1px solid ${C.border}` },
  '.cm-panels.cm-panels-bottom': { borderTop: `1px solid ${C.border}` },
  '.cm-panel.cm-search label': { color: C.fg },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': {
    backgroundColor: C.bg, color: C.fg, border: `1px solid ${C.border}`,
  },
  '.cm-panel.cm-search button:hover': { backgroundColor: C.bgLight },
  '.cm-panel.cm-search [name=close]': { color: C.fg },
}, { dark: true });

const tokyoNightHighlighting = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.keyword, color: C.purple },
  { tag: tags.operator, color: '#89ddff' },
  { tag: tags.special(tags.variableName), color: C.accent },
  { tag: tags.typeName, color: C.cyan },
  { tag: tags.atom, color: C.orange },
  { tag: tags.number, color: C.orange },
  { tag: tags.definition(tags.variableName), color: C.fgBright },
  { tag: tags.string, color: C.green },
  { tag: tags.special(tags.string), color: C.green },
  { tag: tags.comment, color: C.fgDim, fontStyle: 'italic' },
  { tag: tags.variableName, color: C.fgBright },
  { tag: tags.tagName, color: C.red },
  { tag: tags.bracket, color: C.fg },
  { tag: tags.meta, color: C.fgDim },
  { tag: tags.link, color: C.accent, textDecoration: 'underline' },
  { tag: tags.heading, color: C.accent, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic', color: C.purple },
  { tag: tags.strong, fontWeight: 'bold', color: C.purple },
  { tag: tags.className, color: C.cyan },
  { tag: tags.propertyName, color: '#73daca' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: C.accent },
  { tag: tags.bool, color: C.orange },
  { tag: tags.null, color: C.orange },
  { tag: tags.regexp, color: '#b4f9f8' },
  { tag: tags.attributeName, color: C.purple },
  { tag: tags.attributeValue, color: C.green },
]));

// ── VS Code Settings Import ────────────────────────────────────────────────

function guessVSCodeSettingsPath(currentPath: string): string {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) {
    const match = currentPath.match(/^[A-Z]:\\Users\\([^\\]+)/i);
    const username = match ? match[1] : '';
    if (username) {
      return `C:\\Users\\${username}\\AppData\\Roaming\\Code\\User\\settings.json`;
    }
    return 'C:\\Users\\<username>\\AppData\\Roaming\\Code\\User\\settings.json';
  } else if (platform.includes('mac')) {
    return '~/Library/Application Support/Code/User/settings.json';
  }
  return '~/.config/Code/User/settings.json';
}

function parseVSCodeSettings(settingsJson: string): Partial<EditorSettings> {
  try {
    // Strip comments (VS Code settings.json allows // comments)
    const cleaned = settingsJson.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const parsed = JSON.parse(cleaned);
    const result: Partial<EditorSettings> = {};

    if (typeof parsed['editor.fontSize'] === 'number') {
      result.fontSize = parsed['editor.fontSize'];
    }
    if (typeof parsed['editor.fontFamily'] === 'string') {
      result.fontFamily = parsed['editor.fontFamily'];
    }
    if (typeof parsed['editor.tabSize'] === 'number') {
      result.tabSize = parsed['editor.tabSize'];
    }
    if (parsed['editor.wordWrap'] === 'on' || parsed['editor.wordWrap'] === 'wordWrapColumn' || parsed['editor.wordWrap'] === 'bounded') {
      result.wordWrap = true;
    } else if (parsed['editor.wordWrap'] === 'off') {
      result.wordWrap = false;
    }
    if (typeof parsed['editor.lineNumbers'] === 'string') {
      result.lineNumbers = parsed['editor.lineNumbers'] !== 'off';
    }

    return result;
  } catch {
    return {};
  }
}

// ── Inject CSS for keyframes and scrollbars ─────────────────────────────────

let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  cssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ce-spin { to { transform: rotate(360deg) } }
    .ce-overlay *::-webkit-scrollbar { width: 10px; height: 10px; }
    .ce-overlay *::-webkit-scrollbar-track { background: ${C.bg}; }
    .ce-overlay *::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 5px; }
    .ce-overlay *::-webkit-scrollbar-thumb:hover { background: ${C.fgDim}; }
    .ce-overlay *::-webkit-scrollbar-corner { background: ${C.bg}; }
    .ce-overlay .cm-editor { height: 100%; }
    .ce-overlay .cm-scroller { overflow: auto; }
  `;
  document.head.appendChild(style);
}

// ── Components ──────────────────────────────────────────────────────────────

// -- File Tree Item --

function FileTreeItem(props: {
  entry: FileEntry;
  depth: number;
  api: XplorerAPI;
  activeFile: string | null;
  onOpenFile: (path: string) => void;
}) {
  const { entry, depth, api, activeFile, onOpenFile } = props;
  const [expanded, setExpanded] = React.useState(false);
  const [children, setChildren] = React.useState<FileEntry[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const isActive = entry.path === activeFile;

  const handleClick = async () => {
    if (entry.is_dir) {
      if (!expanded && children === null) {
        setLoading(true);
        try {
          const items = await api.files.list(entry.path);
          const sorted = items.sort((a, b) => {
            if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
          setChildren(sorted);
        } catch {
          setChildren([]);
        }
        setLoading(false);
      }
      setExpanded(!expanded);
    } else if (isTextFile(entry.path)) {
      onOpenFile(entry.path);
    }
  };

  const icon = entry.is_dir
    ? (expanded ? '\u25BC' : '\u25B6')
    : getFileIcon(entry.name, false);

  const iconColor = entry.is_dir ? C.yellow : getFileIconColor(entry.name);
  const isIconText = typeof icon === 'string' && icon.length <= 2 && /^[A-Z+]+$/.test(icon);

  return (
    <>
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          paddingLeft: `${8 + depth * 16}px`,
          cursor: 'pointer',
          fontSize: '13px',
          color: isActive ? C.fgBright : C.fg,
          backgroundColor: isActive ? C.selection : 'transparent',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          userSelect: 'none',
        }}
        onMouseEnter={e => {
          if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = C.bgLight;
        }}
        onMouseLeave={e => {
          if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        <span style={{
          fontSize: entry.is_dir ? '8px' : '10px',
          width: '16px',
          textAlign: 'center',
          flexShrink: 0,
          color: iconColor,
          fontWeight: isIconText ? 700 : 400,
          fontFamily: isIconText ? 'monospace' : 'inherit',
        }}>
          {loading ? '\u23F3' : icon}
        </span>
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontWeight: entry.is_dir ? 500 : 400,
        }}>
          {entry.name}
        </span>
      </div>
      {expanded && children && children.map(child => (
        <FileTreeItem
          key={child.path}
          entry={child}
          depth={depth + 1}
          api={api}
          activeFile={activeFile}
          onOpenFile={onOpenFile}
        />
      ))}
    </>
  );
}

// -- File Tree Sidebar --

function FileTree(props: {
  api: XplorerAPI;
  rootPath: string;
  activeFile: string | null;
  onOpenFile: (path: string) => void;
}) {
  const { api, rootPath, activeFile, onOpenFile } = props;
  const [entries, setEntries] = React.useState<FileEntry[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.files.list(rootPath).then(items => {
      if (cancelled) return;
      const sorted = items.sort((a, b) => {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      setEntries(sorted);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setEntries([]);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [rootPath, api]);

  const folderName = rootPath.split(/[/\\]/).filter(Boolean).pop() || rootPath;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      backgroundColor: C.bgDark,
    }}>
      <div style={{
        padding: '8px 12px', fontSize: '11px', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.5px',
        color: C.fgDim, borderBottom: `1px solid ${C.border}`,
      }}>
        {folderName}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingTop: '4px' }}>
        {loading ? (
          <div style={{ padding: '16px', textAlign: 'center', color: C.fgDim, fontSize: '12px' }}>
            Loading...
          </div>
        ) : entries && entries.length > 0 ? (
          entries.map(entry => (
            <FileTreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              api={api}
              activeFile={activeFile}
              onOpenFile={onOpenFile}
            />
          ))
        ) : (
          <div style={{ padding: '16px', textAlign: 'center', color: C.fgDim, fontSize: '12px' }}>
            Empty folder
          </div>
        )}
      </div>
    </div>
  );
}

// -- Tab Bar --

function TabBar(props: {
  files: OpenFile[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: (index: number) => void;
}) {
  const { files, activeIndex, onSelect, onClose } = props;

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      backgroundColor: C.bgDark,
      borderBottom: `1px solid ${C.border}`,
      overflowX: 'auto', overflowY: 'hidden',
      flexShrink: 0, minHeight: '36px',
    }}>
      {files.map((file, i) => {
        const isActive = i === activeIndex;
        const isModified = file.content !== file.originalContent;
        return (
          <div
            key={file.path}
            onClick={() => onSelect(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '0 12px', height: '36px',
              cursor: 'pointer', flexShrink: 0,
              fontSize: '13px',
              color: isActive ? C.fgBright : C.fgDim,
              backgroundColor: isActive ? C.bg : 'transparent',
              borderRight: `1px solid ${C.border}`,
              borderBottom: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
            }}
          >
            <span style={{
              fontSize: '10px', fontWeight: 700, fontFamily: 'monospace',
              color: getFileIconColor(file.path),
            }}>
              {getFileIcon(getFileName(file.path), false)}
            </span>
            <span>{getFileName(file.path)}</span>
            {isModified && (
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: C.fgBright, flexShrink: 0,
              }} />
            )}
            <span
              onClick={e => { e.stopPropagation(); onClose(i); }}
              style={{
                width: '18px', height: '18px', borderRadius: '3px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', color: C.fgDim, flexShrink: 0,
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = C.border;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              {'\u00D7'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// -- CodeMirror Editor Wrapper --

function CMEditor(props: {
  content: string;
  filePath: string;
  settings: EditorSettings;
  onContentChange: (content: string) => void;
  onCursorChange: (line: number, col: number) => void;
  onSave: () => void;
}) {
  const { content, filePath, settings, onContentChange, onCursorChange, onSave } = props;
  const containerRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  const contentRef = React.useRef(content);
  const onSaveRef = React.useRef(onSave);
  const onContentChangeRef = React.useRef(onContentChange);
  const onCursorChangeRef = React.useRef(onCursorChange);

  // Keep refs current
  onSaveRef.current = onSave;
  onContentChangeRef.current = onContentChange;
  onCursorChangeRef.current = onCursorChange;

  // Create/recreate editor when file changes
  React.useEffect(() => {
    if (!containerRef.current) return;

    const tabSizeComp = new Compartment();
    const wrapComp = new Compartment();
    const lineNumComp = new Compartment();

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        tokyoNightTheme,
        tokyoNightHighlighting,
        getLanguageExtension(filePath),
        keymap.of([
          indentWithTab,
          { key: 'Mod-s', run: () => { onSaveRef.current(); return true; } },
        ]),
        tabSizeComp.of(EditorState.tabSize.of(settings.tabSize)),
        wrapComp.of(settings.wordWrap ? EditorView.lineWrapping : []),
        lineNumComp.of([]),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            const newContent = update.state.doc.toString();
            contentRef.current = newContent;
            onContentChangeRef.current(newContent);
          }
          if (update.selectionSet || update.docChanged) {
            const pos = update.state.selection.main.head;
            const line = update.state.doc.lineAt(pos);
            onCursorChangeRef.current(line.number, pos - line.from + 1);
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    contentRef.current = content;

    // Focus after a tick to ensure the editor is mounted
    requestAnimationFrame(() => view.focus());

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Recreate on file path change (new file opened)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

  // Update content if changed externally (e.g. file reload)
  React.useEffect(() => {
    const view = viewRef.current;
    if (view && content !== contentRef.current) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
      contentRef.current = content;
    }
  }, [content]);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1, overflow: 'hidden',
        fontSize: `${settings.fontSize}px`,
        fontFamily: settings.fontFamily,
      }}
    />
  );
}

// -- Status Bar --

function StatusBar(props: {
  cursorLine: number;
  cursorCol: number;
  lineCount: number;
  language: string;
  tabSize: number;
  isModified: boolean;
  encoding?: string;
}) {
  const { cursorLine, cursorCol, lineCount, language, tabSize, isModified, encoding = 'UTF-8' } = props;

  const itemStyle: React.CSSProperties = {
    padding: '0 10px',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      height: '24px', flexShrink: 0,
      backgroundColor: C.accentDim,
      fontSize: '12px', color: '#ccc',
      borderTop: `1px solid ${C.border}`,
    }}>
      <span style={itemStyle}>Ln {cursorLine}, Col {cursorCol}</span>
      <span style={itemStyle}>Spaces: {tabSize}</span>
      <span style={itemStyle}>{encoding}</span>
      <span style={itemStyle}>{language}</span>
      <span style={{ flex: 1 }} />
      {isModified && <span style={{ ...itemStyle, color: C.yellow }}>Modified</span>}
      <span style={itemStyle}>{lineCount} lines</span>
    </div>
  );
}

// -- Settings Panel --

function SettingsPanel(props: {
  settings: EditorSettings;
  onSettingsChange: (settings: EditorSettings) => void;
  api: XplorerAPI;
  currentPath: string;
}) {
  const { settings, onSettingsChange, api, currentPath } = props;
  const [vscodePath, setVscodePath] = React.useState(() => guessVSCodeSettingsPath(currentPath));
  const [importStatus, setImportStatus] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);

  const handleImport = async () => {
    setImporting(true);
    setImportStatus(null);
    try {
      const exists = await api.files.exists(vscodePath);
      if (!exists) {
        setImportStatus('File not found. Check the path and try again.');
        setImporting(false);
        return;
      }
      const text = await api.files.readText(vscodePath);
      const imported = parseVSCodeSettings(text);
      if (Object.keys(imported).length === 0) {
        setImportStatus('No recognized editor settings found in the file.');
      } else {
        onSettingsChange({ ...settings, ...imported });
        const keys = Object.keys(imported).join(', ');
        setImportStatus(`Imported: ${keys}`);
        api.ui.showMessage(`Imported VS Code settings: ${keys}`, 'info');
      }
    } catch (err) {
      setImportStatus(`Error: ${err}`);
    }
    setImporting(false);
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 0', borderBottom: `1px solid ${C.border}`,
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: C.bg, color: C.fgBright,
    border: `1px solid ${C.border}`, borderRadius: '4px',
    padding: '4px 8px', fontSize: '13px', outline: 'none',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      backgroundColor: C.bgDark,
    }}>
      <div style={{
        padding: '8px 12px', fontSize: '11px', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.5px',
        color: C.fgDim, borderBottom: `1px solid ${C.border}`,
      }}>
        Settings
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* Font Size */}
        <div style={labelStyle}>
          <span style={{ color: C.fg, fontSize: '13px' }}>Font Size</span>
          <input
            type="number" min={8} max={32} value={settings.fontSize}
            onChange={e => onSettingsChange({ ...settings, fontSize: Number(e.target.value) })}
            style={{ ...inputStyle, width: '60px', textAlign: 'center' }}
          />
        </div>

        {/* Font Family */}
        <div style={labelStyle}>
          <span style={{ color: C.fg, fontSize: '13px' }}>Font Family</span>
          <input
            type="text" value={settings.fontFamily}
            onChange={e => onSettingsChange({ ...settings, fontFamily: e.target.value })}
            style={{ ...inputStyle, width: '200px' }}
          />
        </div>

        {/* Tab Size */}
        <div style={labelStyle}>
          <span style={{ color: C.fg, fontSize: '13px' }}>Tab Size</span>
          <select
            value={settings.tabSize}
            onChange={e => onSettingsChange({ ...settings, tabSize: Number(e.target.value) })}
            style={{ ...inputStyle, width: '60px' }}
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
          </select>
        </div>

        {/* Word Wrap */}
        <div style={labelStyle}>
          <span style={{ color: C.fg, fontSize: '13px' }}>Word Wrap</span>
          <button
            onClick={() => onSettingsChange({ ...settings, wordWrap: !settings.wordWrap })}
            style={{
              ...inputStyle, cursor: 'pointer', width: '60px', textAlign: 'center',
              backgroundColor: settings.wordWrap ? C.accentDim : C.bg,
              color: settings.wordWrap ? C.fgBright : C.fgDim,
            }}
          >
            {settings.wordWrap ? 'On' : 'Off'}
          </button>
        </div>

        {/* Line Numbers */}
        <div style={labelStyle}>
          <span style={{ color: C.fg, fontSize: '13px' }}>Line Numbers</span>
          <button
            onClick={() => onSettingsChange({ ...settings, lineNumbers: !settings.lineNumbers })}
            style={{
              ...inputStyle, cursor: 'pointer', width: '60px', textAlign: 'center',
              backgroundColor: settings.lineNumbers ? C.accentDim : C.bg,
              color: settings.lineNumbers ? C.fgBright : C.fgDim,
            }}
          >
            {settings.lineNumbers ? 'On' : 'Off'}
          </button>
        </div>

        {/* VS Code Import Section */}
        <div style={{
          marginTop: '24px', padding: '16px',
          backgroundColor: C.bg, borderRadius: '6px',
          border: `1px solid ${C.border}`,
        }}>
          <div style={{
            fontSize: '14px', fontWeight: 600, color: C.fgBright, marginBottom: '8px',
          }}>
            Import from VS Code
          </div>
          <div style={{ fontSize: '12px', color: C.fgDim, marginBottom: '12px' }}>
            Import your editor settings (font, tab size, word wrap) from VS Code.
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '12px', color: C.fgDim, display: 'block', marginBottom: '4px' }}>
              VS Code settings.json path:
            </label>
            <input
              type="text" value={vscodePath}
              onChange={e => setVscodePath(e.target.value)}
              style={{
                ...inputStyle, width: '100%', boxSizing: 'border-box',
                fontSize: '12px',
              }}
            />
          </div>
          <button
            onClick={handleImport}
            disabled={importing}
            style={{
              padding: '6px 16px', borderRadius: '4px', border: 'none',
              backgroundColor: C.accent, color: C.bgDark,
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              opacity: importing ? 0.6 : 1,
            }}
          >
            {importing ? 'Importing...' : 'Import Settings'}
          </button>
          {importStatus && (
            <div style={{
              marginTop: '8px', fontSize: '12px', padding: '8px',
              borderRadius: '4px',
              backgroundColor: importStatus.startsWith('Error') || importStatus.startsWith('File not')
                ? `${C.red}20` : `${C.green}20`,
              color: importStatus.startsWith('Error') || importStatus.startsWith('File not')
                ? C.red : C.green,
            }}>
              {importStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -- Activity Bar (left icon strip) --

function ActivityBar(props: {
  activeView: 'explorer' | 'settings';
  onViewChange: (view: 'explorer' | 'settings') => void;
}) {
  const { activeView, onViewChange } = props;

  const iconBtn = (view: 'explorer' | 'settings', label: string, icon: string) => {
    const isActive = activeView === view;
    return (
      <div
        key={view}
        title={label}
        onClick={() => onViewChange(view)}
        style={{
          width: '48px', height: '48px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: '20px',
          color: isActive ? C.fgBright : C.fgDim,
          borderLeft: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
          backgroundColor: isActive ? C.bgLight : 'transparent',
        }}
        onMouseEnter={e => {
          if (!isActive) (e.currentTarget as HTMLElement).style.color = C.fg;
        }}
        onMouseLeave={e => {
          if (!isActive) (e.currentTarget as HTMLElement).style.color = C.fgDim;
        }}
      >
        {icon}
      </div>
    );
  };

  return (
    <div style={{
      width: '48px', flexShrink: 0,
      backgroundColor: C.bgDark,
      borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', paddingTop: '4px',
    }}>
      {iconBtn('explorer', 'Explorer', '\u{1F4C2}')}
      {iconBtn('settings', 'Settings', '\u2699')}
    </div>
  );
}

// ── Main Editor Overlay ─────────────────────────────────────────────────────

function EditorOverlay(props: {
  api: XplorerAPI;
  rootPath: string;
  initialFile?: string | null;
  onClose: () => void;
}) {
  const { api, rootPath, onClose } = props;

  const [openFiles, setOpenFiles] = React.useState<OpenFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = React.useState(-1);
  const [cursorLine, setCursorLine] = React.useState(1);
  const [cursorCol, setCursorCol] = React.useState(1);
  const [sidebarView, setSidebarView] = React.useState<'explorer' | 'settings'>('explorer');
  const [sidebarWidth] = React.useState(240);
  const [showSidebar, setShowSidebar] = React.useState(true);
  const [settings, setSettings] = React.useState<EditorSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  // Load saved settings
  React.useEffect(() => {
    api.settings.get<EditorSettings>('editorSettings').then(saved => {
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved });
      setSettingsLoaded(true);
    });
  }, [api]);

  // Save settings when they change
  React.useEffect(() => {
    if (settingsLoaded) {
      api.settings.set('editorSettings', settings);
    }
  }, [settings, settingsLoaded, api]);

  // Open initial file
  React.useEffect(() => {
    if (props.initialFile && isTextFile(props.initialFile)) {
      openFile(props.initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;

  const openFile = async (path: string) => {
    // Check if already open
    const existingIndex = openFiles.findIndex(f => f.path === path);
    if (existingIndex >= 0) {
      setActiveFileIndex(existingIndex);
      return;
    }

    try {
      const content = await api.files.readText(path);
      const newFile: OpenFile = {
        path, content, originalContent: content,
        language: getLanguageName(path),
      };
      setOpenFiles(prev => [...prev, newFile]);
      setActiveFileIndex(openFiles.length);
      setCursorLine(1);
      setCursorCol(1);
    } catch (err) {
      api.ui.showMessage(`Failed to open file: ${err}`, 'error');
    }
  };

  const closeFile = (index: number) => {
    const file = openFiles[index];
    if (file.content !== file.originalContent) {
      if (!confirm(`"${getFileName(file.path)}" has unsaved changes. Close anyway?`)) {
        return;
      }
    }
    setOpenFiles(prev => prev.filter((_, i) => i !== index));
    if (activeFileIndex === index) {
      setActiveFileIndex(Math.max(0, index - 1));
    } else if (activeFileIndex > index) {
      setActiveFileIndex(activeFileIndex - 1);
    }
    if (openFiles.length <= 1) {
      setActiveFileIndex(-1);
    }
  };

  const handleContentChange = (content: string) => {
    if (activeFileIndex < 0) return;
    setOpenFiles(prev => prev.map((f, i) =>
      i === activeFileIndex ? { ...f, content } : f
    ));
  };

  const handleSave = async () => {
    if (!activeFile) return;
    try {
      await api.files.write(activeFile.path, activeFile.content);
      setOpenFiles(prev => prev.map((f, i) =>
        i === activeFileIndex ? { ...f, originalContent: f.content } : f
      ));
      api.ui.showMessage(`Saved ${getFileName(activeFile.path)}`, 'info');
    } catch (err) {
      api.ui.showMessage(`Failed to save: ${err}`, 'error');
    }
  };

  const handleClose = () => {
    const hasUnsaved = openFiles.some(f => f.content !== f.originalContent);
    if (hasUnsaved) {
      if (!confirm('You have unsaved changes. Close the editor?')) return;
    }
    onClose();
  };

  // Keyboard shortcut handler for the overlay
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent events from reaching the main app
    e.stopPropagation();

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
      e.preventDefault();
      if (activeFileIndex >= 0) closeFile(activeFileIndex);
    }
    if (e.key === 'Escape') {
      // Only close overlay if no CodeMirror search panel is open
      const searchPanel = document.querySelector('.ce-overlay .cm-panel.cm-search');
      if (!searchPanel) handleClose();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      setShowSidebar(!showSidebar);
    }
  };

  const lineCount = activeFile ? activeFile.content.split('\n').length : 0;
  const isModified = activeFile ? activeFile.content !== activeFile.originalContent : false;

  return (
    <div
      className="ce-overlay"
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', flexDirection: 'column',
        backgroundColor: C.bg, color: C.fg,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Title Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '32px', flexShrink: 0,
        backgroundColor: C.bgDark,
        borderBottom: `1px solid ${C.border}`,
        padding: '0 12px',
        WebkitAppRegion: 'no-drag' as any,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>{'\u{1F4DD}'}</span>
          <span style={{ fontSize: '13px', fontWeight: 500, color: C.fgBright }}>
            Code Editor
          </span>
          {activeFile && (
            <span style={{ fontSize: '12px', color: C.fgDim }}>
              — {getFileName(activeFile.path)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            title="Toggle Sidebar (Ctrl+B)"
            style={{
              background: 'none', border: 'none', color: C.fgDim,
              cursor: 'pointer', fontSize: '14px', padding: '4px 8px',
              borderRadius: '3px',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = C.border}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
          >
            {'\u2630'}
          </button>
          <button
            onClick={handleClose}
            title="Close Editor (Esc)"
            style={{
              background: 'none', border: 'none', color: C.fgDim,
              cursor: 'pointer', fontSize: '18px', padding: '4px 8px',
              borderRadius: '3px',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = C.red;
              el.style.color = C.fgBright;
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.backgroundColor = 'transparent';
              el.style.color = C.fgDim;
            }}
          >
            {'\u00D7'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Activity Bar */}
        <ActivityBar activeView={sidebarView} onViewChange={setSidebarView} />

        {/* Sidebar */}
        {showSidebar && (
          <div style={{
            width: `${sidebarWidth}px`, flexShrink: 0,
            borderRight: `1px solid ${C.border}`,
            overflow: 'hidden',
          }}>
            {sidebarView === 'explorer' ? (
              <FileTree
                api={api}
                rootPath={rootPath}
                activeFile={activeFile?.path || null}
                onOpenFile={openFile}
              />
            ) : (
              <SettingsPanel
                settings={settings}
                onSettingsChange={setSettings}
                api={api}
                currentPath={rootPath}
              />
            )}
          </div>
        )}

        {/* Editor Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {openFiles.length > 0 && (
            <TabBar
              files={openFiles}
              activeIndex={activeFileIndex}
              onSelect={i => {
                setActiveFileIndex(i);
                setCursorLine(1);
                setCursorCol(1);
              }}
              onClose={closeFile}
            />
          )}

          {activeFile ? (
            <CMEditor
              key={activeFile.path}
              content={activeFile.content}
              filePath={activeFile.path}
              settings={settings}
              onContentChange={handleContentChange}
              onCursorChange={(line, col) => {
                setCursorLine(line);
                setCursorCol(col);
              }}
              onSave={handleSave}
            />
          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: C.fgDim, gap: '16px',
            }}>
              <div style={{ fontSize: '48px', opacity: 0.3 }}>{'\u{1F4DD}'}</div>
              <div style={{ fontSize: '16px', fontWeight: 500, color: C.fg }}>
                Code Editor
              </div>
              <div style={{ fontSize: '13px', maxWidth: '300px', textAlign: 'center', lineHeight: 1.6 }}>
                Open a file from the explorer to start editing.
                <br />
                <span style={{ color: C.fgDim }}>
                  Ctrl+S to save {'\u00B7'} Ctrl+F to search {'\u00B7'} Ctrl+B toggle sidebar
                </span>
              </div>
            </div>
          )}

          {activeFile && (
            <StatusBar
              cursorLine={cursorLine}
              cursorCol={cursorCol}
              lineCount={lineCount}
              language={activeFile.language}
              tabSize={settings.tabSize}
              isModified={isModified}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sidebar Panel (Trigger Button) ──────────────────────────────────────────

function SidebarPanel(props: {
  onOpen: () => void;
  selectedFile: string | null;
}) {
  const { onOpen, selectedFile } = props;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100%', padding: '24px',
      gap: '16px', textAlign: 'center',
      color: C.fg, backgroundColor: C.bg,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ fontSize: '48px', opacity: 0.6 }}>{'\u{1F4DD}'}</div>
      <div style={{ fontSize: '16px', fontWeight: 600, color: C.fgBright }}>
        Code Editor
      </div>
      <div style={{ fontSize: '12px', color: C.fgDim, maxWidth: '220px', lineHeight: 1.5 }}>
        VS Code-like editor with syntax highlighting, file tree, and multiple tabs.
      </div>

      <button
        onClick={onOpen}
        style={{
          padding: '10px 24px', borderRadius: '6px',
          border: 'none', backgroundColor: C.accent,
          color: C.bgDark, fontSize: '14px', fontWeight: 600,
          cursor: 'pointer', marginTop: '8px',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.85'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
      >
        Open Editor
      </button>

      <div style={{ fontSize: '11px', color: C.fgDim, marginTop: '4px' }}>
        or press <span style={{
          padding: '2px 6px', backgroundColor: C.border,
          borderRadius: '3px', fontSize: '10px', fontFamily: 'monospace',
        }}>Ctrl+Shift+E</span>
      </div>

      {selectedFile && isTextFile(selectedFile) && (
        <div style={{
          marginTop: '12px', padding: '8px 12px',
          backgroundColor: C.bgDark, borderRadius: '6px',
          border: `1px solid ${C.border}`,
          fontSize: '12px', color: C.fgDim,
          maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          <div style={{ fontSize: '10px', color: C.fgDim, marginBottom: '4px' }}>Selected file:</div>
          <div style={{ color: C.fgBright, fontFamily: 'monospace', fontSize: '11px' }}>
            {getFileName(selectedFile)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root App Component ──────────────────────────────────────────────────────

function EditorApp(props: { api: XplorerAPI; renderProps: PanelRenderProps }) {
  const { api, renderProps } = props;
  const [isOpen, setIsOpen] = React.useState(false);

  // Determine selected file from panel props
  const selectedFile = React.useMemo(() => {
    const files = renderProps.selectedFiles;
    if (!files || !(files instanceof Set) || files.size === 0) return null;
    const first = Array.from(files)[0];
    return typeof first === 'string' ? first : null;
  }, [renderProps.selectedFiles]);

  const currentPath = renderProps.currentPath || '';

  const handleOpen = () => {
    injectCSS();
    setIsOpen(true);
  };

  return (
    <>
      <SidebarPanel
        onOpen={handleOpen}
        selectedFile={selectedFile}
      />
      {isOpen && (
        <EditorOverlay
          api={api}
          rootPath={currentPath}
          initialFile={selectedFile}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

// ── Extension Entry Point ───────────────────────────────────────────────────

let api: XplorerAPI | null = null;
let openEditorCallback: (() => void) | null = null;

const extension = {
  async activate() {
    if (!api) return;

    api.commands.register('codeEditor.open', () => {
      if (openEditorCallback) openEditorCallback();
    });

    api.commands.register('codeEditor.save', () => {
      // Handled inside the editor component
    });

    api.commands.register('codeEditor.toggleWrap', () => {
      // Handled inside settings
    });
  },

  async deactivate() {
    api = null;
    openEditorCallback = null;
  },

  _setContext(_context: unknown, xplorerApi: XplorerAPI) {
    api = xplorerApi;
  },

  render(props: PanelRenderProps) {
    if (!api) {
      return <div style={{ padding: '16px', color: C.fgDim, fontSize: '12px' }}>
        Extension not initialized.
      </div>;
    }
    return <EditorApp api={api} renderProps={props} />;
  },
};

// Register with the Xplorer extension host
if (typeof window !== 'undefined' && (window as any).__xplorer_register__) {
  (window as any).__xplorer_register__(extension);
}

export default extension;
