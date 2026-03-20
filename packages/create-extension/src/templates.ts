/**
 * Template generators for each extension type.
 *
 * Each generator returns { packageJson, tsconfig, source, readme }
 * that the CLI writes into the scaffolded project.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface TemplateVars {
  name: string;
  displayName: string;
  description: string;
  author: string;
  type: string;
  category: string;
  icon: string;
  permissions: string[];
  keywords: string[];
}

export interface TemplateOutput {
  packageJson: Record<string, unknown>;
  tsconfig: Record<string, unknown>;
  source: string;
  readme: string;
}

// ── Shared helpers ───────────────────────────────────────────────────────────

const basePackageJson = (vars: TemplateVars, extra?: Record<string, unknown>): Record<string, unknown> => {
  const needsReact = ['panel', 'preview', 'tab'].includes(vars.type);

  return {
    name: `xplorer-${vars.name}`,
    version: '1.0.0',
    description: vars.description,
    main: 'dist/index.js',
    type: 'module',
    scripts: {
      build:
        'esbuild src/index.tsx --bundle --format=esm --outfile=dist/index.js --external:react --external:react-dom --external:@xplorer/extension-sdk --target=es2020 --jsx=transform',
      watch:
        'esbuild src/index.tsx --bundle --format=esm --outfile=dist/index.js --external:react --external:react-dom --external:@xplorer/extension-sdk --target=es2020 --jsx=transform --watch',
    },
    devDependencies: {
      esbuild: '^0.20.0',
      ...(needsReact ? { '@types/react': '^18.2.0' } : {}),
      typescript: '^5.2.0',
    },
    xplorer: {
      id: vars.name,
      name: vars.displayName,
      displayName: vars.displayName,
      description: vars.description,
      version: '1.0.0',
      author: vars.author,
      category: vars.category,
      icon: vars.icon,
      keywords: vars.keywords,
      permissions: vars.permissions,
      activationEvents: ['onStartup'],
      ...(extra || {}),
    },
  };
};

const baseTsconfig = (): Record<string, unknown> => {
  return {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'react',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: 'dist',
    },
    include: ['src'],
  };
};

const baseReadme = (vars: TemplateVars, features: string[]): string => {
  return `# ${vars.displayName}

${vars.description}

## Features

${features.map((f) => `- ${f}`).join('\n')}

## Development

\`\`\`bash
npm install
npm run build     # one-time production build
npm run watch     # rebuild on file changes
\`\`\`

## Installation

1. Build the extension: \`npm run build\`
2. Open Xplorer
3. Go to Settings > Extensions > Install from Folder
4. Select this extension's directory

## License

MIT

---

Built with the Xplorer Extension SDK
`;
};

// ── Panel template ───────────────────────────────────────────────────────────

const panelTemplate = (vars: TemplateVars): TemplateOutput => {
  const source = `/**
 * ${vars.displayName} Extension
 *
 * A sidebar panel extension for Xplorer.
 * Registers via Sidebar.register() and renders in the right sidebar.
 */

import React, { useState, useCallback } from 'react';
import { Sidebar, type XplorerAPI, type SidebarRenderProps } from '@xplorer/extension-sdk';

// ── Inline SVG Icon ─────────────────────────────────────────────────────────

function PanelIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

// ── Styles (CSS variables for theme support) ────────────────────────────────

const s = {
  container: {
    padding: '16px',
    height: '100%',
    overflowY: 'auto' as const,
    color: 'var(--xp-text)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--xp-text)',
  },
  subtitle: {
    fontSize: '12px',
    color: 'var(--xp-text-secondary, var(--xp-text-muted))',
    margin: '0 0 16px 0',
  },
  card: {
    padding: '12px',
    borderRadius: '6px',
    backgroundColor: 'var(--xp-surface, rgba(255,255,255,0.05))',
    border: '1px solid var(--xp-border, rgba(255,255,255,0.1))',
    marginBottom: '8px',
  },
  button: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--xp-text)',
    backgroundColor: 'var(--xp-blue, #7aa2f7)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginTop: '12px',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '32px 16px',
    color: 'var(--xp-text-secondary, var(--xp-text-muted))',
    fontSize: '12px',
  },
};

// ── Panel Component ─────────────────────────────────────────────────────────

let api: XplorerAPI;

function ${vars.displayName.replace(/\s+/g, '')}Panel({ currentPath }: SidebarRenderProps) {
  const [items, setItems] = useState<string[]>([]);

  const addCurrentPath = useCallback(async () => {
    if (!currentPath) return;
    setItems((prev) => [...prev, currentPath]);
    api.ui.showMessage(\`Added: \${currentPath}\`, 'info');
  }, [currentPath]);

  return (
    <div style={s.container}>
      <div style={s.header}>
        <PanelIcon size={16} />
        <h3 style={s.title}>${vars.displayName}</h3>
      </div>

      <p style={s.subtitle}>${vars.description}</p>

      {items.length > 0 ? (
        items.map((item, i) => (
          <div key={i} style={s.card}>
            <span style={{ fontSize: '12px' }}>{item}</span>
          </div>
        ))
      ) : (
        <div style={s.emptyState}>No items yet. Click the button below to get started.</div>
      )}

      <button style={s.button} onClick={addCurrentPath}>
        Add Current Path
      </button>
    </div>
  );
}

// ── Registration ────────────────────────────────────────────────────────────

Sidebar.register({
  id: '${vars.name}',
  title: '${vars.displayName}',
  icon: '${vars.icon}',
  permissions: ${JSON.stringify(vars.permissions)},
  render: (props) => <${vars.displayName.replace(/\s+/g, '')}Panel {...props} />,
  onActivate: (xplorerApi) => {
    api = xplorerApi;
  },
});
`;

  return {
    packageJson: basePackageJson(vars, {
      contributes: {
        panels: [
          {
            id: vars.name,
            title: vars.displayName,
            location: 'right',
            icon: vars.icon,
          },
        ],
      },
    }),
    tsconfig: baseTsconfig(),
    source,
    readme: baseReadme(vars, [
      'Custom sidebar panel in the right sidebar',
      'Theme-aware styling with CSS variables',
      'Inline SVG icons (no external dependencies)',
    ]),
  };
};

// ── Theme template ───────────────────────────────────────────────────────────

const themeTemplate = (vars: TemplateVars): TemplateOutput => {
  const source = `/**
 * ${vars.displayName} Theme Extension
 *
 * A custom color theme for Xplorer.
 * Registers via Theme.register() with color tokens and optional CSS overrides.
 */

import { Theme } from '@xplorer/extension-sdk';

Theme.register({
  id: '${vars.name}',
  name: '${vars.displayName}',
  background: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
  colors: {
    // Background colors
    bg: '#0d1117',
    surface: '#161b22',
    surfaceLight: '#21262d',

    // Border colors
    border: '#30363d',
    borderLight: '#484f58',

    // Text colors
    text: '#e6edf3',
    textMuted: '#8b949e',
    textSecondary: '#7d8590',

    // Accent colors — customize these!
    blue: '#58a6ff',
    blueDark: '#388bfd',
    green: '#3fb950',
    orange: '#d29922',
    pink: '#f778ba',
    red: '#f85149',
    yellow: '#e3b341',
    cyan: '#56d4dd',
    purple: '#bc8cff',
  },
  // Optional: custom CSS overrides for fine-tuning
  css: \`
.theme-${vars.name} .file-item.selected {
  background-color: rgba(88, 166, 255, 0.15);
  border: 1px solid rgba(88, 166, 255, 0.4);
}
.theme-${vars.name} .sidebar-item.active {
  background-color: rgba(88, 166, 255, 0.15);
}
.theme-${vars.name} .tab-item.active {
  border-bottom-color: #58a6ff;
}
.theme-${vars.name} ::-webkit-scrollbar-thumb {
  background: #30363d;
  border-radius: 4px;
}
.theme-${vars.name} ::-webkit-scrollbar-thumb:hover {
  background: #484f58;
}
.theme-${vars.name} ::selection {
  background-color: rgba(88, 166, 255, 0.3);
  color: #ffffff;
}
\`,
});
`;

  return {
    packageJson: basePackageJson(vars),
    tsconfig: baseTsconfig(),
    source,
    readme: baseReadme(vars, [
      'Custom color theme with full token support',
      'Background gradient',
      'Scrollbar, selection, and focus styling',
      'CSS variable integration with the Xplorer theme system',
    ]),
  };
};

// ── Action (Context Menu) template ───────────────────────────────────────────

const actionTemplate = (vars: TemplateVars): TemplateOutput => {
  const source = `/**
 * ${vars.displayName} Extension
 *
 * A context menu action for Xplorer.
 * Registers via ContextMenu.register() and appears in the right-click menu.
 */

import { ContextMenu, Command, type XplorerAPI, type ContextMenuFile } from '@xplorer/extension-sdk';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getSelectedFile(): { name: string; path: string; is_dir: boolean } | null {
  const state = (window as Record<string, unknown>).__xplorer_state__ as
    { selectedFiles?: Array<{ name: string; path: string; is_dir: boolean }> } | undefined;
  const files = state?.selectedFiles || [];
  return files.length > 0 ? files[0] : null;
}

// ── Core Logic ──────────────────────────────────────────────────────────────

async function processFile(filePath: string, api: XplorerAPI): Promise<void> {
  try {
    const content = await api.files.readText(filePath);
    const filename = filePath.split(/[/\\\\]/).pop() || '';

    // TODO: Replace with your own processing logic
    const lineCount = content.split('\\n').length;
    const charCount = content.length;

    api.ui.showMessage(
      \`\${filename}: \${lineCount} lines, \${charCount} characters\`,
      'info',
    );
  } catch (err) {
    api.ui.showMessage(\`Failed to process file: \${err}\`, 'error');
  }
}

// ── Registration ────────────────────────────────────────────────────────────

ContextMenu.register({
  id: '${vars.name}.process',
  title: '${vars.displayName}: Process File',
  when: 'singleFileSelected',
  permissions: ${JSON.stringify(vars.permissions)},
  action: async (files: ContextMenuFile[], api: XplorerAPI) => {
    if (files.length === 0 || files[0].is_dir) {
      api.ui.showMessage('Select a file first.', 'warning');
      return;
    }
    await processFile(files[0].path, api);
  },
});

// Also register as a command so it appears in the command palette
Command.register({
  id: '${vars.name}.run',
  title: '${vars.displayName}: Process Selected File',
  permissions: ${JSON.stringify(vars.permissions)},
  action: async (api: XplorerAPI) => {
    const file = getSelectedFile();
    if (!file || file.is_dir) {
      api.ui.showMessage('Select a file first.', 'warning');
      return;
    }
    await processFile(file.path, api);
  },
});
`;

  return {
    packageJson: basePackageJson(vars, {
      contributes: {
        commands: [
          {
            command: 'run',
            title: `${vars.displayName}: Process File`,
            category: vars.displayName,
          },
        ],
        context_menus: [
          {
            command: `${vars.name}.process`,
            when: 'singleFileSelected',
            group: 'tools',
          },
        ],
      },
    }),
    tsconfig: baseTsconfig(),
    source,
    readme: baseReadme(vars, [
      'Right-click context menu action on files',
      'Also available from the command palette',
      'Theme-aware notifications',
    ]),
  };
};

// ── Preview template ─────────────────────────────────────────────────────────

const previewTemplate = (vars: TemplateVars): TemplateOutput => {
  const source = `/**
 * ${vars.displayName} Extension
 *
 * A file preview handler for Xplorer.
 * Registers via Preview.register() and renders a custom preview for matching files.
 */

import React, { useState, useEffect } from 'react';
import { Preview, type XplorerAPI, type PreviewRenderProps, type PreviewFile } from '@xplorer/extension-sdk';

// ── Constants ───────────────────────────────────────────────────────────────

// TODO: Customize the file extensions this preview handles
const SUPPORTED_EXTENSIONS = new Set(['txt', 'md', 'log']);

function getExtension(path: string): string {
  return path.split('.').pop()?.toLowerCase() || '';
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  container: {
    padding: '16px',
    height: '100%',
    overflowY: 'auto' as const,
    color: 'var(--xp-text)',
  },
  header: {
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '12px',
    color: 'var(--xp-text)',
  },
  content: {
    padding: '12px',
    borderRadius: '6px',
    backgroundColor: 'var(--xp-surface, rgba(255,255,255,0.05))',
    border: '1px solid var(--xp-border, rgba(255,255,255,0.1))',
    fontSize: '12px',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap' as const,
    fontFamily: 'var(--xp-font-mono, monospace)',
  },
  loading: {
    textAlign: 'center' as const,
    padding: '32px',
    color: 'var(--xp-text-secondary, var(--xp-text-muted))',
    fontSize: '12px',
  },
  error: {
    padding: '12px',
    borderRadius: '6px',
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    border: '1px solid rgba(248, 81, 73, 0.3)',
    color: 'var(--xp-red, #f85149)',
    fontSize: '12px',
  },
};

// ── Preview Component ───────────────────────────────────────────────────────

let api: XplorerAPI;

function FilePreview({ selectedFiles }: PreviewRenderProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const file = selectedFiles?.[0];

  useEffect(() => {
    if (!file) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    api.files
      .readText(file.path)
      .then((text: string) => {
        if (!cancelled) {
          setContent(text);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(String(err));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file?.path]);

  if (!file) {
    return <div style={s.loading}>Select a file to preview.</div>;
  }

  if (loading) {
    return <div style={s.loading}>Loading preview...</div>;
  }

  if (error) {
    return <div style={s.error}>Failed to load preview: {error}</div>;
  }

  const filename = file.path.split(/[/\\\\]/).pop() || file.name;

  return (
    <div style={s.container}>
      <div style={s.header}>{filename}</div>
      <div style={s.content}>{content}</div>
    </div>
  );
}

// ── Registration ────────────────────────────────────────────────────────────

Preview.register({
  id: '${vars.name}',
  title: '${vars.displayName}',
  icon: '${vars.icon}',
  description: '${vars.description}',
  permissions: ${JSON.stringify(vars.permissions)},
  canPreview: (file: PreviewFile) => {
    if (file.is_dir) return false;
    return SUPPORTED_EXTENSIONS.has(getExtension(file.path));
  },
  priority: 15, // Higher than default (10) to take precedence
  render: (props) => <FilePreview {...props} />,
  onActivate: (xplorerApi) => {
    api = xplorerApi;
  },
});
`;

  return {
    packageJson: basePackageJson(vars, {
      contributes: {
        panels: [
          {
            id: vars.name,
            title: vars.displayName,
            location: 'right',
            icon: vars.icon,
          },
        ],
      },
    }),
    tsconfig: baseTsconfig(),
    source,
    readme: baseReadme(vars, [
      'Custom file preview for supported file types',
      'Loading and error states',
      'Theme-aware styling with CSS variables',
      'Configurable file extension matching',
    ]),
  };
};

// ── Command template ─────────────────────────────────────────────────────────

const commandTemplate = (vars: TemplateVars): TemplateOutput => {
  const source = `/**
 * ${vars.displayName} Extension
 *
 * A command palette command for Xplorer.
 * Registers via Command.register() with an optional keyboard shortcut.
 *
 * Usage: Open the command palette (Ctrl+Shift+P) and search for "${vars.displayName}".
 */

import { Command, type XplorerAPI } from '@xplorer/extension-sdk';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getSelectedFile(): { name: string; path: string; is_dir: boolean } | null {
  const state = (window as Record<string, unknown>).__xplorer_state__ as
    { selectedFiles?: Array<{ name: string; path: string; is_dir: boolean }> } | undefined;
  const files = state?.selectedFiles || [];
  return files.length > 0 ? files[0] : null;
}

// ── Registration ────────────────────────────────────────────────────────────

Command.register({
  id: '${vars.name}.run',
  title: '${vars.displayName}',
  shortcut: 'ctrl+shift+alt+x', // TODO: Customize your keyboard shortcut
  permissions: ${JSON.stringify(vars.permissions)},
  action: async (api: XplorerAPI) => {
    const file = getSelectedFile();

    if (!file) {
      api.ui.showMessage('No file selected. Select a file first.', 'warning');
      return;
    }

    if (file.is_dir) {
      api.ui.showMessage('Please select a file, not a directory.', 'warning');
      return;
    }

    try {
      const content = await api.files.readText(file.path);

      // TODO: Replace with your own logic
      const lines = content.split('\\n').length;
      const words = content.trim() === '' ? 0 : content.trim().split(/\\s+/).length;
      const chars = content.length;

      api.ui.showMessage(
        \`\${file.name}: \${words} words, \${lines} lines, \${chars} characters\`,
        'info',
      );

      // Optionally persist results
      await api.settings.set('lastResult', {
        file: file.path,
        words,
        lines,
        chars,
        timestamp: Date.now(),
      });
    } catch (err) {
      api.ui.showMessage(\`Failed to process file: \${err}\`, 'error');
    }
  },
});
`;

  return {
    packageJson: basePackageJson(vars, {
      contributes: {
        commands: [
          {
            command: 'run',
            title: vars.displayName,
            category: vars.displayName,
          },
        ],
        keybindings: [
          {
            command: `${vars.name}.run`,
            key: 'ctrl+shift+alt+x',
            title: vars.displayName,
          },
        ],
      },
    }),
    tsconfig: baseTsconfig(),
    source,
    readme: baseReadme(vars, [
      'Command palette integration',
      'Keyboard shortcut (Ctrl+Shift+Alt+X)',
      'File reading and analysis',
      'Persistent settings storage',
    ]),
  };
};

// ── Tab template ─────────────────────────────────────────────────────────────

const tabTemplate = (vars: TemplateVars): TemplateOutput => {
  const schemeName = vars.name.replace(/-/g, '');
  const source = `/**
 * ${vars.displayName} Extension
 *
 * A custom tab view for Xplorer.
 * Registers via Tab.register() with its own URL scheme (${schemeName}://).
 * Can be opened via api.navigation.navigateTo('${schemeName}://home').
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Tab, Command, type XplorerAPI, type TabRenderProps } from '@xplorer/extension-sdk';

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    color: 'var(--xp-text)',
    backgroundColor: 'var(--xp-bg, #0a0a1a)',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--xp-border, rgba(255,255,255,0.1))',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
  },
  content: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto' as const,
  },
  card: {
    padding: '16px',
    borderRadius: '8px',
    backgroundColor: 'var(--xp-surface, rgba(255,255,255,0.05))',
    border: '1px solid var(--xp-border, rgba(255,255,255,0.1))',
    marginBottom: '12px',
    cursor: 'pointer',
  },
  cardTitle: {
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '4px',
  },
  cardDescription: {
    fontSize: '12px',
    color: 'var(--xp-text-secondary, var(--xp-text-muted))',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '12px',
    color: 'var(--xp-text-secondary, var(--xp-text-muted))',
  },
  button: {
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--xp-text)',
    backgroundColor: 'var(--xp-blue, #7aa2f7)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};

// ── Tab Component ───────────────────────────────────────────────────────────

let api: XplorerAPI;

interface PageItem {
  id: string;
  title: string;
  description: string;
}

function ${vars.displayName.replace(/\s+/g, '')}Tab({ path, onNavigate }: TabRenderProps) {
  const [items, setItems] = useState<PageItem[]>([
    { id: '1', title: 'Getting Started', description: 'Learn how to use ${vars.displayName}' },
    { id: '2', title: 'Settings', description: 'Configure ${vars.displayName} options' },
    { id: '3', title: 'About', description: 'Version and credits' },
  ]);

  const handleItemClick = useCallback(
    (item: PageItem) => {
      if (onNavigate) {
        onNavigate(\`${schemeName}://\${item.id}\`, item.title);
      }
    },
    [onNavigate],
  );

  return (
    <div style={s.container}>
      <div style={s.header}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <path d="M3 9h18" />
        </svg>
        <h2 style={s.title}>${vars.displayName}</h2>
      </div>

      <div style={s.content}>
        {items.map((item) => (
          <div key={item.id} style={s.card} onClick={() => handleItemClick(item)}>
            <div style={s.cardTitle}>{item.title}</div>
            <div style={s.cardDescription}>{item.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Registration ────────────────────────────────────────────────────────────

Tab.register({
  id: '${vars.name}',
  title: '${vars.displayName}',
  icon: '${vars.icon}',
  urlScheme: '${schemeName}://',
  permissions: ${JSON.stringify(vars.permissions)},
  render: (props) => <${vars.displayName.replace(/\s+/g, '')}Tab {...props} />,
  onActivate: (xplorerApi) => {
    api = xplorerApi;
  },
});

// Command to open this tab from the command palette
Command.register({
  id: '${vars.name}.open',
  title: 'Open ${vars.displayName}',
  permissions: ['ui:panels'],
  action: async (cmdApi: XplorerAPI) => {
    cmdApi.navigation.navigateTo('${schemeName}://home');
  },
});
`;

  return {
    packageJson: basePackageJson(vars, {
      contributes: {
        tabs: [
          {
            id: vars.name,
            title: vars.displayName,
            icon: vars.icon,
            urlScheme: `${schemeName}://`,
          },
        ],
        commands: [
          {
            command: 'open',
            title: `Open ${vars.displayName}`,
            category: vars.displayName,
          },
        ],
      },
    }),
    tsconfig: baseTsconfig(),
    source,
    readme: baseReadme(vars, [
      `Custom tab view with URL scheme (\`${schemeName}://\`)`,
      'In-tab navigation between pages',
      'Command palette integration to open the tab',
      'Theme-aware card-based layout',
    ]),
  };
};

// ── Dispatcher ───────────────────────────────────────────────────────────────

const generators: Record<string, (vars: TemplateVars) => TemplateOutput> = {
  panel: panelTemplate,
  theme: themeTemplate,
  action: actionTemplate,
  preview: previewTemplate,
  command: commandTemplate,
  tab: tabTemplate,
};

export const getTemplate = (type: string, vars: TemplateVars): TemplateOutput => {
  const gen = generators[type];
  if (!gen) {
    throw new Error(`Unknown extension type: "${type}". Valid types: ${Object.keys(generators).join(', ')}`);
  }
  return gen(vars);
};
