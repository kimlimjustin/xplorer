import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SidebarTab, Editor, Command, useCurrentPath, type XplorerAPI } from '@xplorer/extension-sdk';

// ── Types ────────────────────────────────────────────────────────────────────

interface ArchNode {
  id: string;
  label: string;
  kind: 'folder' | 'file' | 'group';
  children: ArchNode[];
  filePath?: string;
  depth: number;
  fileCount?: number;
}

interface ArchData {
  projectName: string;
  generatedAt: string;
  rootPath: string;
  tree: ArchNode[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'target',
  '.cache', '.turbo', '__pycache__', '.venv', 'venv',
  '.orchestrate', '.husky', '.vscode', '.idea',
]);

const GROUP_LABELS: Record<string, string> = {
  src: 'Source',
  lib: 'Library',
  components: 'Components',
  pages: 'Pages',
  hooks: 'Hooks',
  utils: 'Utilities',
  api: 'API',
  routes: 'Routes',
  models: 'Models',
  services: 'Services',
  styles: 'Styles',
  tests: 'Tests',
  __tests__: 'Tests',
  public: 'Public Assets',
  assets: 'Assets',
  config: 'Configuration',
  types: 'Types',
  contexts: 'Contexts',
  locales: 'Locales',
};

const KIND_COLORS: Record<string, string> = {
  folder: 'rgba(122, 162, 247, 0.85)',
  file: 'rgba(192, 202, 245, 0.6)',
  group: 'rgba(187, 154, 247, 0.85)',
};

// ── Shared state (between sidebar and editor) ────────────────────────────────

let sharedArchData: ArchData | null = null;
let sharedApi: XplorerAPI | null = null;
const listeners: Set<() => void> = new Set();

const notifyListeners = () => {
  listeners.forEach((fn) => fn());
};

// ── Scanner ──────────────────────────────────────────────────────────────────

const scanDirectory = async (
  api: XplorerAPI,
  dirPath: string,
  depth: number,
  maxDepth: number,
): Promise<ArchNode[]> => {
  if (depth >= maxDepth) return [];

  try {
    const entries = await api.files.list(dirPath);
    const nodes: ArchNode[] = [];

    const dirs = entries.filter((e: { is_dir: boolean; name: string }) =>
      e.is_dir && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.')
    );
    const files = entries.filter((e: { is_dir: boolean; name: string }) =>
      !e.is_dir && !e.name.startsWith('.')
    );

    for (const dir of dirs) {
      const children = await scanDirectory(api, dir.path, depth + 1, maxDepth);
      const label = GROUP_LABELS[dir.name] || dir.name;
      nodes.push({
        id: dir.path,
        label,
        kind: children.length > 0 ? 'group' : 'folder',
        children,
        filePath: dir.path,
        depth,
        fileCount: countFiles(children) + files.length,
      });
    }

    if (depth > 0 && files.length > 0 && files.length <= 8) {
      for (const file of files) {
        nodes.push({
          id: file.path,
          label: file.name,
          kind: 'file',
          children: [],
          filePath: file.path,
          depth,
        });
      }
    }

    return nodes;
  } catch {
    return [];
  }
};

const countFiles = (nodes: ArchNode[]): number => {
  let count = 0;
  for (const node of nodes) {
    if (node.kind === 'file') count++;
    count += countFiles(node.children);
  }
  return count;
};

// ── Sidebar Tree Component ───────────────────────────────────────────────────

const TreeNode: React.FC<{
  node: ArchNode;
  selectedId: string | null;
  onSelect: (node: ArchNode) => void;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}> = ({ node, selectedId, onSelect, expanded, onToggle }) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const indent = node.depth * 16;

  return (
    <>
      <div
        onClick={() => {
          onSelect(node);
          if (hasChildren) onToggle(node.id);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          paddingLeft: indent + 8,
          cursor: 'pointer',
          fontSize: 12,
          color: isSelected ? 'var(--xp-text, #c0caf5)' : 'var(--xp-text-muted, #565f89)',
          backgroundColor: isSelected ? 'rgba(122, 162, 247, 0.1)' : 'transparent',
          borderLeft: isSelected ? '2px solid var(--xp-blue, #7aa2f7)' : '2px solid transparent',
          transition: 'background-color 0.1s',
          whiteSpace: 'nowrap' as const,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {hasChildren && (
          <span style={{ fontSize: 10, opacity: 0.5, width: 10, textAlign: 'center' }}>
            {isExpanded ? '▾' : '▸'}
          </span>
        )}
        {!hasChildren && <span style={{ width: 10 }} />}
        <span style={{
          width: 6, height: 6, borderRadius: node.kind === 'file' ? 1 : 3,
          backgroundColor: KIND_COLORS[node.kind] || KIND_COLORS.folder,
          flexShrink: 0,
        }} />
        <span style={{ fontWeight: node.kind === 'group' ? 500 : 400 }}>
          {node.label}
        </span>
        {node.fileCount != null && node.fileCount > 0 && (
          <span style={{ fontSize: 10, opacity: 0.4, marginLeft: 'auto', paddingRight: 4 }}>
            {node.fileCount}
          </span>
        )}
      </div>
      {hasChildren && isExpanded && node.children.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          selectedId={selectedId}
          onSelect={onSelect}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </>
  );
};

const ArchitectSidebar: React.FC = () => {
  const currentPath = useCurrentPath();
  const [archData, setArchData] = useState<ArchData | null>(sharedArchData);
  const [scanning, setScanning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const listener = () => setArchData(sharedArchData);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!sharedApi || !currentPath) return;
    setScanning(true);
    setError(null);

    try {
      const tree = await scanDirectory(sharedApi, currentPath, 0, 4);
      const projectName = currentPath.split('/').pop() || currentPath.split('\\').pop() || 'Project';
      const data: ArchData = {
        projectName,
        generatedAt: new Date().toISOString(),
        rootPath: currentPath,
        tree,
      };
      sharedArchData = data;
      setArchData(data);

      const topIds = new Set(tree.map((n) => n.id));
      setExpanded(topIds);

      const archFilePath = currentPath.replace(/\/$/, '') + '/.xparch';
      try {
        await sharedApi.files.write(archFilePath, JSON.stringify(data, null, 2));
        sharedApi.navigation.openFile(archFilePath);
      } catch {
        // File write may fail in read-only dirs — still show in sidebar
      }

      notifyListeners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, [currentPath]);

  const handleToggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback((node: ArchNode) => {
    setSelectedId(node.id);
    if (node.filePath && sharedApi) {
      if (node.kind === 'file') {
        sharedApi.navigation.openFile(node.filePath);
      } else {
        sharedApi.navigation.navigateTo(node.filePath);
      }
    }
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      color: 'var(--xp-text, #c0caf5)', fontSize: 13,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 12px 8px',
        borderBottom: '1px solid rgba(var(--xp-border-rgb, 41, 46, 66), 0.5)',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const,
          letterSpacing: '0.05em', color: 'var(--xp-text-muted, #565f89)',
          marginBottom: 8,
        }}>
          Architecture
        </div>
        <button
          onClick={handleGenerate}
          disabled={scanning}
          style={{
            width: '100%', padding: '7px 12px', fontSize: 12, fontWeight: 500,
            borderRadius: 6, border: 'none', cursor: scanning ? 'wait' : 'pointer',
            backgroundColor: scanning ? 'rgba(122, 162, 247, 0.3)' : 'rgba(122, 162, 247, 0.85)',
            color: '#fff', transition: 'opacity 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
          onMouseEnter={(e) => { if (!scanning) e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          {scanning ? (
            <>
              <span style={{
                width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Scanning...
            </>
          ) : (
            <>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
              Generate Architecture
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '8px 12px', fontSize: 11, color: '#f87171',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
        }}>
          {error}
        </div>
      )}

      {/* Tree */}
      <div style={{ flex: 1, overflow: 'auto', paddingTop: 4, paddingBottom: 8 }}>
        {!archData && !scanning && (
          <div style={{
            padding: '24px 16px', textAlign: 'center' as const,
            color: 'var(--xp-text-muted, #565f89)', fontSize: 12,
          }}>
            Click "Generate Architecture" to scan the current project and visualize its structure.
          </div>
        )}
        {archData && archData.tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            selectedId={selectedId}
            onSelect={handleSelect}
            expanded={expanded}
            onToggle={handleToggle}
          />
        ))}
      </div>

      {/* Footer */}
      {archData && (
        <div style={{
          padding: '6px 12px', fontSize: 10, color: 'var(--xp-text-muted, #565f89)',
          borderTop: '1px solid rgba(var(--xp-border-rgb, 41, 46, 66), 0.3)',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{archData.projectName}</span>
          <span>{archData.tree.length} modules</span>
        </div>
      )}

      {/* Keyframe animation for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ── Main Area Graph Component ────────────────────────────────────────────────

const GraphNode: React.FC<{
  node: ArchNode;
  isRoot?: boolean;
  onNavigate: (path: string) => void;
}> = ({ node, isRoot, onNavigate }) => {
  const [hovered, setHovered] = useState(false);
  const hasChildren = node.children.filter((c) => c.kind !== 'file').length > 0;
  const fileChildren = node.children.filter((c) => c.kind === 'file');
  const dirChildren = node.children.filter((c) => c.kind !== 'file');

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: isRoot ? 32 : 16,
    }}>
      {/* Node card */}
      <div
        onClick={() => node.filePath && onNavigate(node.filePath)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 6, padding: isRoot ? '16px 24px' : '10px 16px',
          borderRadius: isRoot ? 12 : 8,
          backgroundColor: hovered
            ? 'rgba(122, 162, 247, 0.15)'
            : isRoot
              ? 'rgba(122, 162, 247, 0.08)'
              : 'rgba(var(--xp-border-rgb, 41, 46, 66), 0.3)',
          border: `1px solid ${isRoot ? 'rgba(122, 162, 247, 0.25)' : 'rgba(var(--xp-border-rgb, 41, 46, 66), 0.4)'}`,
          cursor: 'pointer',
          transition: 'all 0.15s',
          minWidth: isRoot ? 160 : 100,
          maxWidth: isRoot ? 300 : 180,
        }}
      >
        <span style={{
          width: isRoot ? 10 : 8, height: isRoot ? 10 : 8,
          borderRadius: node.kind === 'file' ? 2 : '50%',
          backgroundColor: KIND_COLORS[node.kind] || KIND_COLORS.folder,
        }} />
        <span style={{
          fontSize: isRoot ? 15 : 12, fontWeight: isRoot ? 600 : 500,
          color: 'var(--xp-text, #c0caf5)', textAlign: 'center' as const,
          lineHeight: 1.3,
        }}>
          {node.label}
        </span>
        {fileChildren.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--xp-text-muted, #565f89)' }}>
            {fileChildren.length} file{fileChildren.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Connector line */}
      {hasChildren && (
        <div style={{
          width: 1, height: 16,
          backgroundColor: 'rgba(var(--xp-border-rgb, 41, 46, 66), 0.4)',
        }} />
      )}

      {/* Children row */}
      {hasChildren && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
          gap: 12, position: 'relative',
        }}>
          {/* Horizontal connector */}
          {dirChildren.length > 1 && (
            <div style={{
              position: 'absolute', top: -9, left: '15%', right: '15%',
              height: 1,
              backgroundColor: 'rgba(var(--xp-border-rgb, 41, 46, 66), 0.3)',
            }} />
          )}
          {dirChildren.map((child) => (
            <GraphNode key={child.id} node={child} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
};

const ArchitectEditor: React.FC<{ filePath: string }> = ({ filePath }) => {
  const [data, setData] = useState<ArchData | null>(sharedArchData);

  useEffect(() => {
    if (sharedArchData) {
      setData(sharedArchData);
      return;
    }
    if (sharedApi && filePath) {
      sharedApi.files.readText(filePath).then((text) => {
        try {
          const parsed = JSON.parse(text) as ArchData;
          sharedArchData = parsed;
          setData(parsed);
          notifyListeners();
        } catch { /* invalid file */ }
      }).catch(() => {});
    }
  }, [filePath]);

  useEffect(() => {
    const listener = () => setData(sharedArchData);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const handleNavigate = useCallback((path: string) => {
    if (sharedApi) sharedApi.navigation.navigateTo(path);
  }, []);

  if (!data) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--xp-text-muted, #565f89)', fontSize: 13,
      }}>
        No architecture data. Use the sidebar to generate one.
      </div>
    );
  }

  const rootNode: ArchNode = {
    id: '__root__',
    label: data.projectName,
    kind: 'group',
    children: data.tree,
    depth: 0,
    filePath: data.rootPath,
  };

  return (
    <div style={{
      height: '100%', overflow: 'auto',
      backgroundColor: 'var(--xp-bg, #1a1b26)',
      padding: 32,
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
    }}>
      <GraphNode node={rootNode} isRoot onNavigate={handleNavigate} />
    </div>
  );
};

// ── Extension Registration ───────────────────────────────────────────────────

SidebarTab.register({
  id: 'xplorer-architect',
  title: 'Architecture',
  icon: 'layout',
  permissions: ['file:read', 'directory:list', 'ui:panels'],
  render: () => <ArchitectSidebar />,
  onActivate: (api) => {
    sharedApi = api;
  },
});

Editor.register({
  id: 'xplorer-architect-editor',
  title: 'Architecture View',
  extensions: ['xparch'],
  priority: 50,
  permissions: ['file:read'],
  render: (props) => <ArchitectEditor filePath={props.filePath} />,
  onActivate: (api) => {
    sharedApi = api;
  },
});

Command.register({
  id: 'xplorer-architect.generate',
  title: 'Generate Architecture',
  shortcut: 'ctrl+shift+a',
  permissions: ['file:read', 'directory:list'],
  action: async (api) => {
    const path = api.navigation.getCurrentPath();
    if (!path) return;
    sharedApi = api;
    const tree = await scanDirectory(api, path, 0, 4);
    const projectName = path.split('/').pop() || path.split('\\').pop() || 'Project';
    sharedArchData = {
      projectName,
      generatedAt: new Date().toISOString(),
      rootPath: path,
      tree,
    };
    notifyListeners();
    try {
      const archFilePath = path.replace(/\/$/, '') + '/.xparch';
      await api.files.write(archFilePath, JSON.stringify(sharedArchData, null, 2));
      api.navigation.openFile(archFilePath);
    } catch {
      api.ui.showMessage('Architecture generated — check the sidebar', 'info');
    }
  },
});
