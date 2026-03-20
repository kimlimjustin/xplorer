/**
 * Tree computation utility for move/copy preview dialog.
 * Merges source files into a destination directory tree, detecting conflicts.
 */

import type { FileEntry } from '@/lib/tauri-api';
import { detectSep } from '@/lib/constants';

// ── Types ────────────────────────────────────────────────────────────────────

export type TreeNodeStatus = 'existing' | 'incoming' | 'conflict';
export type ConflictResolutionType = 'skip' | 'overwrite' | 'rename';

export interface TreeNode {
  /** Display name of the file/folder */
  name: string;
  /** Full path (source path for incoming, destination path for existing) */
  path: string;
  /** Whether this node is a directory */
  isDir: boolean;
  /** File size in bytes (0 for directories) */
  size: number;
  /** Children nodes (only for directories) */
  children: TreeNode[];
  /** Status of this node in the merge operation */
  status: TreeNodeStatus;
  /** If status is 'conflict', user-chosen resolution */
  conflictResolution?: ConflictResolutionType;
  /** Original source path (for incoming/conflict nodes) */
  sourcePath?: string;
}

export interface MoveTreeResult {
  /** The full merged tree representing the destination after the operation */
  tree: TreeNode[];
  /** Flat list of conflict nodes (references into the tree) */
  conflicts: TreeNode[];
  /** Total size of incoming files (bytes) */
  totalIncomingSize: number;
  /** Total size of existing destination (bytes) */
  totalExistingSize: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fileEntryToTreeNode = (entry: FileEntry, status: TreeNodeStatus) : TreeNode => {
  return {
    name: entry.name,
    path: entry.path,
    isDir: entry.is_dir,
    size: entry.size,
    children: [],
    status,
  };
}

/**
 * Build a flat list of TreeNode from a set of FileEntry items.
 * Each item becomes a root-level node. Directories are leaf nodes here
 * (we don't recursively read their contents for the preview).
 */
const buildSourceNodes = (files: FileEntry[]) : TreeNode[] => {
  return files.map((f) => ({
    ...fileEntryToTreeNode(f, 'incoming'),
    sourcePath: f.path,
  }));
}

const buildDestNodes = (files: FileEntry[]) : TreeNode[] => {
  return files.map((f) => fileEntryToTreeNode(f, 'existing'));
}

// ── Core merge ───────────────────────────────────────────────────────────────

/**
 * Compute the resulting directory tree after merging source files into
 * the destination directory.
 *
 * @param sourceFiles  - Files being moved/copied
 * @param destPath     - Destination directory path
 * @param destFiles    - Existing files in the destination directory
 * @returns Merged tree + flat conflict list
 */
export const computeMoveTree = (
  sourceFiles: FileEntry[],
  destPath: string,
  destFiles: FileEntry[],
) : MoveTreeResult => {
  const sep = detectSep(destPath);
  const destNodes = buildDestNodes(destFiles);
  const sourceNodes = buildSourceNodes(sourceFiles);

  // Index existing destination nodes by lowercase name for conflict detection
  const destByName = new Map<string, TreeNode>();
  for (const node of destNodes) {
    destByName.set(node.name.toLowerCase(), node);
  }

  const conflicts: TreeNode[] = [];
  const merged: TreeNode[] = [...destNodes];

  for (const srcNode of sourceNodes) {
    const key = srcNode.name.toLowerCase();
    const existing = destByName.get(key);

    if (existing) {
      // Name collision detected — mark as conflict
      const conflictNode: TreeNode = {
        ...srcNode,
        path: `${destPath}${destPath.endsWith(sep) ? '' : sep}${srcNode.name}`,
        status: 'conflict',
        conflictResolution: undefined,
        sourcePath: srcNode.path,
      };
      // Replace the existing node with a conflict node in the merged tree
      const idx = merged.indexOf(existing);
      if (idx >= 0) {
        merged[idx] = conflictNode;
      } else {
        merged.push(conflictNode);
      }
      conflicts.push(conflictNode);
    } else {
      // No collision — add as incoming
      const incomingNode: TreeNode = {
        ...srcNode,
        path: `${destPath}${destPath.endsWith(sep) ? '' : sep}${srcNode.name}`,
        status: 'incoming',
        sourcePath: srcNode.path,
      };
      merged.push(incomingNode);
    }
  }

  // Sort: directories first, then alphabetically
  merged.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  const totalIncomingSize = sourceFiles.reduce((sum, f) => sum + (f.is_dir ? 0 : f.size), 0);
  const totalExistingSize = destFiles.reduce((sum, f) => sum + (f.is_dir ? 0 : f.size), 0);

  return {
    tree: merged,
    conflicts,
    totalIncomingSize,
    totalExistingSize,
  };
}

/**
 * Check if all conflicts have been resolved.
 */
export const allConflictsResolved = (conflicts: TreeNode[]) : boolean => {
  return conflicts.every((c) => c.conflictResolution != null);
}

/**
 * Count unresolved conflicts.
 */
export const unresolvedConflictCount = (conflicts: TreeNode[]) : number => {
  return conflicts.filter((c) => c.conflictResolution == null).length;
}
