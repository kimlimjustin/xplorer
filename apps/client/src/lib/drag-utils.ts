import type { FileEntry } from '@/lib/tauri-api';

/** Check if `child` path is inside `parent` path */
export const isDescendantPath = (parent: string, child: string): boolean => {
  const normalize = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const np = normalize(parent);
  const nc = normalize(child);
  return nc.startsWith(`${np}/`);
};

/** Validate whether files can be dropped on a target */
export const validateDrop = (
  draggedPaths: string[],
  targetPath: string,
): { valid: boolean; reason?: string } => {
  // Can't drop onto the same file
  if (draggedPaths.some((p) => normalize(p) === normalize(targetPath))) {
    return { valid: false, reason: 'Cannot drop a file onto itself' };
  }
  // Can't drop a folder into its own descendant
  if (draggedPaths.some((p) => isDescendantPath(p, targetPath))) {
    return { valid: false, reason: 'Cannot move a folder into its own subfolder' };
  }
  // Can't drop files into their current parent (no-op)
  const parents = new Set(draggedPaths.map((p) => getParentPath(p)));
  if (parents.size === 1 && normalize([...parents][0]) === normalize(targetPath)) {
    return { valid: false, reason: 'Files are already in this folder' };
  }
  return { valid: true };
};

/** Build destination path for a file dropped into a target directory */
export const buildDestinationPath = (sourcePath: string, targetDir: string): string => {
  const name = sourcePath.split(/[/\\]/).pop() || sourcePath;
  const sep = targetDir.includes('\\') ? '\\' : '/';
  return targetDir.replace(/[/\\]+$/, '') + sep + name;
};

/** Get parent directory of a path */
export const getParentPath = (filePath: string): string => {
  const parts = filePath.replace(/\\/g, '/').replace(/\/+$/, '').split('/');
  parts.pop();
  return parts.join('/') || '/';
};

const normalize = (p: string): string => {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
};

/** MIME type for internal drag data */
export const XPLORER_DND_MIME = 'application/x-xplorer-files';

/** Serialize file paths for dataTransfer */
export const serializeDragData = (files: FileEntry[]): string => {
  return JSON.stringify(files.map((f) => ({ path: f.path, name: f.name, is_dir: f.is_dir })));
};

/** Deserialize file paths from dataTransfer */
export const deserializeDragData = (
  data: string,
): { path: string; name: string; is_dir: boolean }[] => {
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown): item is { path: string; name: string; is_dir: boolean } =>
        typeof item === 'object' &&
        item !== null &&
        'path' in item &&
        'name' in item &&
        'is_dir' in item &&
        typeof (item as Record<string, unknown>).path === 'string' &&
        typeof (item as Record<string, unknown>).name === 'string' &&
        typeof (item as Record<string, unknown>).is_dir === 'boolean',
    );
  } catch (e) {
    console.warn('Failed to deserialize drag data:', e);
    return [];
  }
};
