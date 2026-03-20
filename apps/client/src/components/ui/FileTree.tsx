/**
 * Reusable collapsible file tree renderer.
 * Uses inline styles with CSS variables (--xp-*) for theming.
 * Supports keyboard navigation, expand/collapse, and custom right-side content.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FolderClosed, FolderOpen, FileIcon, ChevronRight, ChevronDown } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FileTreeNode {
  /** Unique identifier (usually the file path) */
  id: string;
  /** Display name */
  name: string;
  /** Whether this is a directory */
  isDir: boolean;
  /** Children nodes (only for directories) */
  children?: FileTreeNode[];
  /** Custom data attached to this node */
  data?: Record<string, unknown>;
}

export interface FileTreeProps {
  /** The tree nodes to render */
  nodes: FileTreeNode[];
  /** Depth level (used internally for indentation) */
  depth?: number;
  /** Set of node IDs that are initially expanded */
  defaultExpanded?: Set<string>;
  /** Render custom content on the right side of each node */
  renderRightContent?: (node: FileTreeNode) => React.ReactNode;
  /** Render a custom icon for the node. Falls back to folder/file icons. */
  renderIcon?: (node: FileTreeNode) => React.ReactNode;
  /** Custom class name for the node row based on node data */
  getNodeStyle?: (node: FileTreeNode) => React.CSSProperties;
  /** Called when a node is clicked */
  onNodeClick?: (node: FileTreeNode) => void;
  /** Enable keyboard navigation */
  enableKeyboard?: boolean;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: {
    width: '100%',
    fontSize: '13px',
    lineHeight: '1.4',
    userSelect: 'none' as const,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    padding: '3px 8px',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background-color 0.1s ease',
    gap: '4px',
    minHeight: '28px',
  },
  rowHover: {
    backgroundColor: 'var(--xp-surface-light)',
  },
  rowFocused: {
    backgroundColor: 'var(--xp-surface-light)',
    outline: '1px solid var(--xp-blue)',
    outlineOffset: '-1px',
  },
  indentGuide: {
    display: 'inline-block',
    width: '1px',
    height: '28px',
    backgroundColor: 'var(--xp-border)',
    marginLeft: '9px',
    marginRight: '9px',
    flexShrink: 0,
  },
  chevron: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    flexShrink: 0,
    color: 'var(--xp-text-secondary)',
  },
  chevronPlaceholder: {
    width: '16px',
    height: '16px',
    flexShrink: 0,
  },
  icon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    flexShrink: 0,
  },
  name: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    color: 'var(--xp-text)',
  },
  rightContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
    marginLeft: '8px',
  },
};

// ── TreeNodeRow (memoized) ───────────────────────────────────────────────────

interface TreeNodeRowProps {
  node: FileTreeNode;
  depth: number;
  isExpanded: boolean;
  onToggle: () => void;
  renderRightContent?: (node: FileTreeNode) => React.ReactNode;
  renderIcon?: (node: FileTreeNode) => React.ReactNode;
  getNodeStyle?: (node: FileTreeNode) => React.CSSProperties;
  onNodeClick?: (node: FileTreeNode) => void;
  isFocused: boolean;
  onFocus: () => void;
}

const TreeNodeRow = React.memo(function TreeNodeRow({
  node,
  depth,
  isExpanded,
  onToggle,
  renderRightContent,
  renderIcon,
  getNodeStyle,
  onNodeClick,
  isFocused,
  onFocus,
}: TreeNodeRowProps) {
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(() => {
    onFocus();
    if (node.isDir) {
      onToggle();
    }
    onNodeClick?.(node);
  }, [node, onToggle, onNodeClick, onFocus]);

  const customStyle = getNodeStyle?.(node) ?? {};

  const rowStyle: React.CSSProperties = {
    ...styles.row,
    ...(hovered ? styles.rowHover : {}),
    ...(isFocused ? styles.rowFocused : {}),
    ...customStyle,
  };

  const defaultIcon = node.isDir ? (
    isExpanded ? (
      <FolderOpen size={16} style={{ color: 'var(--xp-blue)' }} />
    ) : (
      <FolderClosed size={16} style={{ color: 'var(--xp-blue)' }} />
    )
  ) : (
    <FileIcon size={16} style={{ color: 'var(--xp-text-secondary)' }} />
  );

  return (
    <div
      style={rowStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      role="treeitem"
      aria-expanded={node.isDir ? isExpanded : undefined}
      aria-level={depth + 1}
      tabIndex={-1}
    >
      {/* Indent guides */}
      {Array.from({ length: depth }, (_, i) => (
        <div key={i} style={styles.indentGuide} />
      ))}

      {/* Expand/collapse chevron */}
      {node.isDir ? (
        <div style={styles.chevron}>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      ) : (
        <div style={styles.chevronPlaceholder} />
      )}

      {/* Icon */}
      <div style={styles.icon}>{renderIcon ? renderIcon(node) : defaultIcon}</div>

      {/* Name */}
      <div style={styles.name} title={node.name}>
        {node.name}
      </div>

      {/* Right-side content (size, status badge, conflict resolution, etc.) */}
      {renderRightContent && <div style={styles.rightContent}>{renderRightContent(node)}</div>}
    </div>
  );
});

// ── FileTree (recursive) ─────────────────────────────────────────────────────

const FileTree = ({
  nodes,
  depth = 0,
  defaultExpanded,
  renderRightContent,
  renderIcon,
  getNodeStyle,
  onNodeClick,
  enableKeyboard = false,
}: FileTreeProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => defaultExpanded ?? new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleNode = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Flatten visible nodes for keyboard navigation
  const flattenVisible = useCallback((): FileTreeNode[] => {
    const result: FileTreeNode[] = [];
    const walk = (items: FileTreeNode[]) => {
      for (const node of items) {
        result.push(node);
        if (node.isDir && expanded.has(node.id) && node.children) {
          walk(node.children);
        }
      }
    };
    walk(nodes);
    return result;
  }, [nodes, expanded]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enableKeyboard) return;

      const visible = flattenVisible();
      const currentIdx = visible.findIndex((n) => n.id === focusedId);

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIdx = Math.min(currentIdx + 1, visible.length - 1);
          setFocusedId(visible[nextIdx]?.id ?? null);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevIdx = Math.max(currentIdx - 1, 0);
          setFocusedId(visible[prevIdx]?.id ?? null);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (focusedId) {
            const node = visible.find((n) => n.id === focusedId);
            if (node?.isDir && !expanded.has(node.id)) {
              toggleNode(node.id);
            }
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (focusedId) {
            const node = visible.find((n) => n.id === focusedId);
            if (node?.isDir && expanded.has(node.id)) {
              toggleNode(node.id);
            }
          }
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          if (focusedId) {
            const node = visible.find((n) => n.id === focusedId);
            if (node) {
              if (node.isDir) toggleNode(node.id);
              onNodeClick?.(node);
            }
          }
          break;
        }
      }
    },
    [enableKeyboard, flattenVisible, focusedId, expanded, toggleNode, onNodeClick],
  );

  // Auto-expand all directories at mount for shallow trees
  useEffect(() => {
    if (defaultExpanded) {
      setExpanded(defaultExpanded);
    }
  }, [defaultExpanded]);

  const renderNodes = (items: FileTreeNode[], d: number): React.ReactNode => {
    return items.map((node) => (
      <React.Fragment key={node.id}>
        <TreeNodeRow
          node={node}
          depth={d}
          isExpanded={expanded.has(node.id)}
          onToggle={() => toggleNode(node.id)}
          renderRightContent={renderRightContent}
          renderIcon={renderIcon}
          getNodeStyle={getNodeStyle}
          onNodeClick={onNodeClick}
          isFocused={focusedId === node.id}
          onFocus={() => setFocusedId(node.id)}
        />
        {node.isDir &&
          expanded.has(node.id) &&
          node.children &&
          node.children.length > 0 &&
          renderNodes(node.children, d + 1)}
      </React.Fragment>
    ));
  };

  return (
    <div
      ref={containerRef}
      style={styles.container}
      role="tree"
      tabIndex={enableKeyboard ? 0 : undefined}
      onKeyDown={enableKeyboard ? handleKeyDown : undefined}
    >
      {renderNodes(nodes, depth)}
    </div>
  );
}

export default FileTree;
