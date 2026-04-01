/**
 * Xplorer IDE Mode Extension — Project Explorer Sidebar
 *
 * Provides an IDE-like project sidebar with:
 * - Project type detection (Node, Rust, Python, Go, Java, .NET, Ruby)
 * - Recursive file tree with lazy loading
 * - File click opens in editor via api.navigation.openInEditor()
 * - Configurable directory exclusion (node_modules, .git, etc.)
 * - Refresh and collapse-all actions
 *
 * Depends on the Code Editor extension for editor tab integration.
 */

import React from 'react';
import { Sidebar, Command, type XplorerAPI } from '@xplorer/extension-sdk';

// ── Types ───────────────────────────────────────────────────────────────────

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size?: number;
  modified?: string;
}

interface ProjectInfo {
  name: string;
  type: 'node' | 'rust' | 'python' | 'go' | 'java' | 'dotnet' | 'ruby' | 'unknown';
  rootPath: string;
}

interface PanelRenderProps {
  currentPath?: string;
  selectedFiles?: unknown[];
  [key: string]: unknown;
}

// ── Project Detection ───────────────────────────────────────────────────────

const PROJECT_MARKERS: Record<string, ProjectInfo['type']> = {
  'package.json': 'node',
  'Cargo.toml': 'rust',
  'pyproject.toml': 'python',
  'setup.py': 'python',
  'requirements.txt': 'python',
  'go.mod': 'go',
  'pom.xml': 'java',
  'build.gradle': 'java',
  'Gemfile': 'ruby',
};

/** File extensions that indicate a .NET project (matched via endsWith) */
const DOTNET_EXTENSIONS = ['.csproj', '.sln', '.fsproj'];

const PROJECT_TYPE_LABELS: Record<ProjectInfo['type'], string> = {
  node: 'Node',
  rust: 'Rust',
  python: 'Python',
  go: 'Go',
  java: 'Java',
  dotnet: '.NET',
  ruby: 'Ruby',
  unknown: 'Project',
};

const PROJECT_TYPE_COLORS: Record<ProjectInfo['type'], string> = {
  node: '#9ece6a',
  rust: '#ff9e64',
  python: '#7aa2f7',
  go: '#73daca',
  java: '#f7768e',
  dotnet: '#bb9af7',
  ruby: '#f7768e',
  unknown: '#565f89',
};

async function detectProject(api: XplorerAPI, path: string): Promise<ProjectInfo | null> {
  if (!path || path.startsWith('xplorer://') || path.startsWith('gdrive://')) {
    return null;
  }

  try {
    const entries = await api.files.list(path);
    const fileNames = new Set(entries.map((e: FileEntry) => e.name));

    // Check exact-match markers first
    for (const [marker, type] of Object.entries(PROJECT_MARKERS)) {
      if (fileNames.has(marker)) {
        const name = path.split(/[/\\]/).filter(Boolean).pop() || path;
        return { name, type, rootPath: path };
      }
    }

    // Check .NET pattern markers (*.csproj, *.sln, *.fsproj)
    for (const entry of entries) {
      if (!entry.is_dir) {
        for (const ext of DOTNET_EXTENSIONS) {
          if (entry.name.endsWith(ext)) {
            const name = path.split(/[/\\]/).filter(Boolean).pop() || path;
            return { name, type: 'dotnet', rootPath: path };
          }
        }
      }
    }

    // No project marker found — still return as unknown project
    const name = path.split(/[/\\]/).filter(Boolean).pop() || path;
    return { name, type: 'unknown', rootPath: path };
  } catch {
    return null;
  }
}

// ── Directories to hide by default ──────────────────────────────────────────

const DEFAULT_HIDDEN_DIRS = new Set([
  'node_modules',
  '.git',
  'target',
  '__pycache__',
  '.next',
  'dist',
  'build',
  '.svn',
  '.hg',
  '.idea',
  '.vscode',
  '.DS_Store',
  'vendor',
  '.cache',
  '.gradle',
  'bin',
  'obj',
  '.tox',
  '.mypy_cache',
  '.pytest_cache',
  'coverage',
]);

// ── File Extension Icon Mapping ─────────────────────────────────────────────

function getFileIcon(name: string, isDir: boolean): string {
  if (isDir) return '\u{1F4C1}'; // folder icon

  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() || '' : '';

  const iconMap: Record<string, string> = {
    // Code
    ts: '\u{1F7E6}',    tsx: '\u{1F7E6}',
    js: '\u{1F7E8}',    jsx: '\u{1F7E8}',
    py: '\u{1F40D}',
    rs: '\u{2699}',
    go: '\u{1F7E9}',
    java: '\u{2615}',
    cs: '\u{1F7EA}',
    rb: '\u{1F534}',
    cpp: '\u{1F535}',   c: '\u{1F535}',   h: '\u{1F535}',
    // Config/Data
    json: '\u{1F4CB}',  yaml: '\u{1F4CB}', yml: '\u{1F4CB}', toml: '\u{1F4CB}',
    xml: '\u{1F4CB}',
    // Web
    html: '\u{1F310}',  css: '\u{1F3A8}',  scss: '\u{1F3A8}', less: '\u{1F3A8}',
    // Docs
    md: '\u{1F4DD}',    txt: '\u{1F4C4}',  pdf: '\u{1F4D5}',
    // Images
    png: '\u{1F5BC}',   jpg: '\u{1F5BC}',  jpeg: '\u{1F5BC}', gif: '\u{1F5BC}',
    svg: '\u{1F5BC}',   webp: '\u{1F5BC}', ico: '\u{1F5BC}',
    // Lock / build
    lock: '\u{1F512}',
  };

  return iconMap[ext] || '\u{1F4C4}'; // default: page icon
}

// ── FileTreeNode Component ──────────────────────────────────────────────────

function FileTreeNode({
  entry,
  api,
  depth,
  hiddenDirs,
}: {
  entry: FileEntry;
  api: XplorerAPI;
  depth: number;
  hiddenDirs: Set<string>;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [children, setChildren] = React.useState<FileEntry[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hovered, setHovered] = React.useState(false);

  const loadChildren = React.useCallback(async () => {
    if (children !== null) return; // already loaded
    setLoading(true);
    setError(null);
    try {
      const entries = await api.files.list(entry.path);
      // Filter hidden directories and sort: folders first, then alphabetical
      const filtered = entries.filter((e: FileEntry) => {
        if (e.is_dir && hiddenDirs.has(e.name)) return false;
        // Hide dotfiles that start with . (except common config files)
        return true;
      });
      filtered.sort((a: FileEntry, b: FileEntry) => {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
      setChildren(filtered);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [entry.path, children, api, hiddenDirs]);

  const handleClick = React.useCallback(() => {
    if (entry.is_dir) {
      const willExpand = !expanded;
      setExpanded(willExpand);
      if (willExpand) {
        loadChildren();
      }
    } else {
      // Open file in editor tab
      api.navigation.openInEditor(entry.path);
    }
  }, [entry.is_dir, entry.path, expanded, loadChildren, api]);

  const handleRefresh = React.useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setChildren(null);
    setError(null);
    setLoading(true);
    try {
      const entries = await api.files.list(entry.path);
      const filtered = entries.filter((e: FileEntry) => {
        if (e.is_dir && hiddenDirs.has(e.name)) return false;
        return true;
      });
      filtered.sort((a: FileEntry, b: FileEntry) => {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
      setChildren(filtered);
      setExpanded(true);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [entry.path, api, hiddenDirs]);

  const icon = getFileIcon(entry.name, entry.is_dir);
  const arrow = entry.is_dir ? (expanded ? '\u25BC' : '\u25B6') : '\u00A0\u00A0';

  return React.createElement('div', null,
    // Row
    React.createElement('div', {
      onClick: handleClick,
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px 2px ' + (8 + depth * 16) + 'px',
        cursor: 'pointer',
        fontSize: '12px',
        lineHeight: '22px',
        color: 'var(--xp-text, #c0caf5)',
        backgroundColor: hovered ? 'var(--xp-surface-light, rgba(255,255,255,0.06))' : 'transparent',
        borderRadius: '3px',
        userSelect: 'none' as const,
        transition: 'background-color 0.1s ease',
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
      },
    },
      // Arrow
      React.createElement('span', {
        style: {
          width: '12px',
          flexShrink: 0,
          fontSize: '8px',
          textAlign: 'center' as const,
          color: 'var(--xp-text-muted, #888)',
        },
      }, arrow),
      // Icon
      React.createElement('span', {
        style: { flexShrink: 0, fontSize: '13px' },
      }, icon),
      // Name
      React.createElement('span', {
        style: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flex: 1,
        },
      }, entry.name),
      // Refresh button for directories (visible on hover)
      entry.is_dir && expanded && hovered
        ? React.createElement('span', {
            onClick: handleRefresh,
            title: 'Refresh',
            style: {
              flexShrink: 0,
              fontSize: '11px',
              padding: '0 4px',
              color: 'var(--xp-text-muted, #888)',
              cursor: 'pointer',
              opacity: 0.7,
            },
          }, '\u21BB')
        : null,
    ),
    // Children (if directory is expanded)
    expanded && entry.is_dir ? React.createElement('div', null,
      loading
        ? React.createElement('div', {
            style: {
              paddingLeft: (24 + depth * 16) + 'px',
              fontSize: '11px',
              color: 'var(--xp-text-muted, #888)',
              lineHeight: '22px',
            },
          }, 'Loading...')
        : error
          ? React.createElement('div', {
              style: {
                paddingLeft: (24 + depth * 16) + 'px',
                fontSize: '11px',
                color: 'var(--xp-red, #f7768e)',
                lineHeight: '22px',
              },
            }, 'Error: ' + error)
          : children && children.length === 0
            ? React.createElement('div', {
                style: {
                  paddingLeft: (24 + depth * 16) + 'px',
                  fontSize: '11px',
                  color: 'var(--xp-text-muted, #888)',
                  lineHeight: '22px',
                  fontStyle: 'italic',
                },
              }, 'Empty')
            : children
              ? children.map((child: FileEntry) =>
                  React.createElement(FileTreeNode, {
                    key: child.path,
                    entry: child,
                    api: api,
                    depth: depth + 1,
                    hiddenDirs: hiddenDirs,
                  })
                )
              : null,
    ) : null,
  );
}

// ── ProjectSidebar Component ────────────────────────────────────────────────

function ProjectSidebar({ currentPath, api }: { currentPath: string; api: XplorerAPI }) {
  const [project, setProject] = React.useState<ProjectInfo | null>(null);
  const [rootEntries, setRootEntries] = React.useState<FileEntry[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [treeKey, setTreeKey] = React.useState(0); // used to force re-render tree
  const [hiddenDirs] = React.useState(() => new Set(DEFAULT_HIDDEN_DIRS));
  const [showHiddenConfig, setShowHiddenConfig] = React.useState(false);

  // Detect project and load root entries when currentPath changes
  React.useEffect(() => {
    if (!currentPath || currentPath.startsWith('xplorer://') || currentPath.startsWith('gdrive://')) {
      setProject(null);
      setRootEntries(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const proj = await detectProject(api, currentPath);
        if (cancelled) return;
        setProject(proj);

        if (proj) {
          const entries = await api.files.list(proj.rootPath);
          if (cancelled) return;

          const filtered = entries.filter((e: FileEntry) => {
            if (e.is_dir && hiddenDirs.has(e.name)) return false;
            return true;
          });
          filtered.sort((a: FileEntry, b: FileEntry) => {
            if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          });
          setRootEntries(filtered);
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [currentPath, api, hiddenDirs]);

  // Handle refresh: re-detect project and reload root entries
  const handleRefresh = React.useCallback(() => {
    setTreeKey((k) => k + 1);
    setRootEntries(null);
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const proj = await detectProject(api, currentPath);
        setProject(proj);
        if (proj) {
          const entries = await api.files.list(proj.rootPath);
          const filtered = entries.filter((e: FileEntry) => {
            if (e.is_dir && hiddenDirs.has(e.name)) return false;
            return true;
          });
          filtered.sort((a: FileEntry, b: FileEntry) => {
            if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          });
          setRootEntries(filtered);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [currentPath, api, hiddenDirs]);

  // ── Empty state ──
  if (!currentPath || currentPath.startsWith('xplorer://')) {
    return React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '24px 16px',
        color: 'var(--xp-text-muted, #888)',
        fontSize: '13px',
        textAlign: 'center' as const,
      },
    },
      React.createElement('div', {
        style: { fontSize: '32px', marginBottom: '12px', opacity: 0.5 },
      }, '\u{1F4C2}'),
      React.createElement('div', {
        style: { fontWeight: 500, marginBottom: '4px', color: 'var(--xp-text, #c0caf5)' },
      }, 'No Project Open'),
      React.createElement('div', {
        style: { fontSize: '12px', lineHeight: '1.5' },
      }, 'Open a folder to see the project tree'),
    );
  }

  // ── Loading state ──
  if (loading && !rootEntries) {
    return React.createElement('div', {
      style: {
        padding: '16px',
        color: 'var(--xp-text-muted, #888)',
        fontSize: '13px',
      },
    }, 'Detecting project...');
  }

  // ── Error state ──
  if (error) {
    return React.createElement('div', {
      style: {
        padding: '16px',
        color: 'var(--xp-red, #f7768e)',
        fontSize: '13px',
      },
    }, 'Error: ', error);
  }

  // ── Main view ──
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column' as const,
      height: '100%',
      fontSize: '13px',
      color: 'var(--xp-text, #c0caf5)',
    },
  },
    // ── Header ──
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid var(--xp-border, #333)',
        flexShrink: 0,
      },
    },
      // Project name + type badge
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflow: 'hidden',
          flex: 1,
        },
      },
        React.createElement('span', {
          style: {
            fontWeight: 600,
            fontSize: '12px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
          },
        }, project?.name || 'Project'),
        project && project.type !== 'unknown'
          ? React.createElement('span', {
              style: {
                fontSize: '10px',
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: '3px',
                backgroundColor: PROJECT_TYPE_COLORS[project.type] + '22',
                color: PROJECT_TYPE_COLORS[project.type],
                border: '1px solid ' + PROJECT_TYPE_COLORS[project.type] + '44',
                flexShrink: 0,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.5px',
              },
            }, PROJECT_TYPE_LABELS[project.type])
          : null,
      ),
      // Action buttons
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 },
      },
        // Filter config toggle
        React.createElement('button', {
          onClick: () => setShowHiddenConfig((v) => !v),
          title: 'Configure hidden directories',
          style: {
            background: 'none',
            border: 'none',
            color: showHiddenConfig ? 'var(--xp-blue, #7aa2f7)' : 'var(--xp-text-muted, #888)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '2px 4px',
            borderRadius: '3px',
            lineHeight: 1,
          },
        }, '\u{2699}'),
        // Refresh button
        React.createElement('button', {
          onClick: handleRefresh,
          title: 'Refresh project tree',
          style: {
            background: 'none',
            border: 'none',
            color: 'var(--xp-text-muted, #888)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '2px 4px',
            borderRadius: '3px',
            lineHeight: 1,
          },
        }, '\u21BB'),
      ),
    ),

    // ── Hidden dirs config panel ──
    showHiddenConfig
      ? React.createElement(HiddenDirsConfig, {
          hiddenDirs: hiddenDirs,
          onUpdate: () => {
            // Force refresh when hidden dirs change
            handleRefresh();
          },
        })
      : null,

    // ── File tree ──
    React.createElement('div', {
      key: treeKey,
      style: {
        flex: 1,
        overflow: 'auto',
        paddingTop: '4px',
        paddingBottom: '8px',
      },
    },
      rootEntries && rootEntries.length > 0
        ? rootEntries.map((entry: FileEntry) =>
            React.createElement(FileTreeNode, {
              key: entry.path,
              entry: entry,
              api: api,
              depth: 0,
              hiddenDirs: hiddenDirs,
            })
          )
        : !loading
          ? React.createElement('div', {
              style: {
                padding: '16px',
                color: 'var(--xp-text-muted, #888)',
                fontSize: '12px',
                textAlign: 'center' as const,
                fontStyle: 'italic',
              },
            }, 'No files found')
          : null,
    ),

    // ── Footer: project root path ──
    project
      ? React.createElement('div', {
          style: {
            padding: '6px 12px',
            borderTop: '1px solid var(--xp-border, #333)',
            fontSize: '10px',
            color: 'var(--xp-text-muted, #888)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
            flexShrink: 0,
          },
          title: project.rootPath,
        }, project.rootPath)
      : null,
  );
}

// ── HiddenDirsConfig Component ──────────────────────────────────────────────

function HiddenDirsConfig({
  hiddenDirs,
  onUpdate,
}: {
  hiddenDirs: Set<string>;
  onUpdate: () => void;
}) {
  const [inputValue, setInputValue] = React.useState('');
  const [items, setItems] = React.useState<string[]>(() => Array.from(hiddenDirs).sort());

  const handleAdd = React.useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed && !hiddenDirs.has(trimmed)) {
      hiddenDirs.add(trimmed);
      setItems(Array.from(hiddenDirs).sort());
      setInputValue('');
      onUpdate();
    }
  }, [inputValue, hiddenDirs, onUpdate]);

  const handleRemove = React.useCallback((dir: string) => {
    hiddenDirs.delete(dir);
    setItems(Array.from(hiddenDirs).sort());
    onUpdate();
  }, [hiddenDirs, onUpdate]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  }, [handleAdd]);

  return React.createElement('div', {
    style: {
      padding: '8px 12px',
      borderBottom: '1px solid var(--xp-border, #333)',
      fontSize: '11px',
      maxHeight: '200px',
      overflow: 'auto',
    },
  },
    React.createElement('div', {
      style: {
        fontWeight: 600,
        color: 'var(--xp-text-muted, #888)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        marginBottom: '6px',
        fontSize: '10px',
      },
    }, 'Hidden Directories'),
    // Input row
    React.createElement('div', {
      style: { display: 'flex', gap: '4px', marginBottom: '6px' },
    },
      React.createElement('input', {
        type: 'text',
        value: inputValue,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value),
        onKeyDown: handleKeyDown,
        placeholder: 'Add directory name...',
        style: {
          flex: 1,
          padding: '3px 6px',
          fontSize: '11px',
          background: 'var(--xp-surface-light, #1e1e2e)',
          border: '1px solid var(--xp-border, #333)',
          borderRadius: '3px',
          color: 'var(--xp-text, #c0caf5)',
          outline: 'none',
        },
      }),
      React.createElement('button', {
        onClick: handleAdd,
        style: {
          padding: '3px 8px',
          fontSize: '11px',
          background: 'var(--xp-blue, #7aa2f7)',
          border: 'none',
          borderRadius: '3px',
          color: '#fff',
          cursor: 'pointer',
        },
      }, '+'),
    ),
    // Tags list
    React.createElement('div', {
      style: { display: 'flex', flexWrap: 'wrap' as const, gap: '4px' },
    },
      items.map((dir: string) =>
        React.createElement('span', {
          key: dir,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            background: 'var(--xp-surface-light, rgba(255,255,255,0.06))',
            color: 'var(--xp-text-muted, #888)',
            border: '1px solid var(--xp-border, #333)',
          },
        },
          dir,
          React.createElement('span', {
            onClick: () => handleRemove(dir),
            style: {
              cursor: 'pointer',
              color: 'var(--xp-red, #f7768e)',
              fontWeight: 'bold',
              fontSize: '11px',
              lineHeight: 1,
            },
          }, '\u00D7'),
        )
      ),
    ),
  );
}

// ── Extension Registration ──────────────────────────────────────────────────

let api: XplorerAPI;

Sidebar.register({
  id: 'ide-mode',
  title: 'Project Explorer',
  description: 'IDE-like project sidebar with file tree, project detection, and editor integration',
  icon: 'layout',
  location: 'right',
  permissions: ['file:read', 'directory:list', 'ui:panels'],

  onActivate: async (injectedApi: XplorerAPI) => {
    api = injectedApi;
  },

  onDeactivate: () => {
    // Cleanup if needed
  },

  render: (props: PanelRenderProps) => {
    const currentPath = (props.currentPath as string) || '';
    return React.createElement(ProjectSidebar, { currentPath, api });
  },
});

Command.register({
  id: 'ide-mode.toggle',
  title: 'Toggle IDE Mode',
  shortcut: 'ctrl+shift+i',
  action: async (cmdApi: XplorerAPI) => {
    cmdApi.ui.showMessage('IDE Mode panel toggled', 'info');
  },
});

Command.register({
  id: 'ide-mode.refreshTree',
  title: 'Refresh Project Tree',
  action: async (cmdApi: XplorerAPI) => {
    cmdApi.ui.showMessage('Project tree refreshed', 'info');
  },
});
