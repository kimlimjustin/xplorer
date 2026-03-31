/**
 * Shared paste/conflict-resolution logic used by both the context-menu paste
 * action and the keyboard-shortcut paste handler in useFileOperations.
 */

import { TauriAPI, type FileEntry, type ConflictFileInfo } from '@/lib/tauri-api';
import { detectSep } from '@/lib/constants';
import { toast as rawToast } from '@/hooks/use-toast';
import type { ConflictResolution } from '@/components/dialogs/FileConflictDialog';
import { formatError } from '@/lib/file-operation-helpers';

// ── Types ────────────────────────────────────────────────────────────────────

export type ResolveConflictFn = (
  fileName: string,
  isDir: boolean,
  destination: string,
  remaining: number,
  sourceInfo?: ConflictFileInfo | null,
  destInfo?: ConflictFileInfo | null,
) => Promise<{ resolution: ConflictResolution; applyToAll: boolean }>;

export interface PasteContext {
  files: FileEntry[];
  operation: 'copy' | 'cut';
  targetPath: string;
  resolveConflict?: ResolveConflictFn;
  /** Called after each file-level activity (create, modified, etc.) */
  emitFileActivity: (type: string, path: string, name?: string, oldPath?: string) => void;
  /** Notify the app that files changed */
  emitFilesChanged: () => void;
}

export interface PasteResult {
  succeeded: number;
  errors: string[];
  isCut: boolean;
}

// ── Core paste loop ──────────────────────────────────────────────────────────

/**
 * Execute the paste operation for the given files into `targetPath`.
 * Handles conflict detection, progress toast, and per-file copy/move.
 *
 * Returns a summary so the caller can update clipboard state and show toasts.
 */
export async function executePaste(ctx: PasteContext): Promise<PasteResult> {
  const { files, operation, targetPath, resolveConflict, emitFileActivity, emitFilesChanged } = ctx;
  const total = files.length;
  const isCut = operation === 'cut';
  const verb = isCut ? 'Moving' : 'Copying';

  // Pre-check conflicts to get metadata for source vs destination comparison
  const conflictMap = new Map<string, { source: ConflictFileInfo; dest: ConflictFileInfo }>();
  try {
    const sourcePaths = files.map((f) => f.path);
    const conflicts = await TauriAPI.checkConflicts(sourcePaths, targetPath);
    for (const c of conflicts) {
      conflictMap.set(c.source.name, { source: c.source, dest: c.destination });
    }
  } catch {
    // If pre-check fails, fall back to per-file existence check
  }

  const progressToast =
    total > 1 ? rawToast({ title: `${verb}...`, description: `0 / ${total} items` }) : null;

  let succeeded = 0;
  const errors: string[] = [];
  let applyToAllRes: ConflictResolution | null = null;
  const sep = detectSep(targetPath);

  for (let i = 0; i < total; i++) {
    const file = files[i];
    try {
      let destination = `${targetPath}${targetPath.endsWith(sep) ? '' : sep}${file.name}`;

      const normSrc = file.path.replace(/[/\\]/g, '/').toLowerCase();
      const normDst = destination.replace(/[/\\]/g, '/').toLowerCase();

      if (normSrc === normDst && !isCut) {
        destination = await TauriAPI.getRenameDest(targetPath, file.name);
      } else if (conflictMap.has(file.name) || (await TauriAPI.fileExists(destination))) {
        let resolution: ConflictResolution | null = applyToAllRes;
        if (!resolution && resolveConflict) {
          const remaining = total - i - 1;
          const conflict = conflictMap.get(file.name);
          const result = await resolveConflict(
            file.name,
            file.is_dir,
            targetPath,
            remaining,
            conflict?.source ?? null,
            conflict?.dest ?? null,
          );
          resolution = result.resolution;
          if (result.applyToAll) applyToAllRes = resolution;
        }
        if (!resolution) resolution = 'replace';
        if (resolution === 'skip') {
          succeeded++;
          continue;
        }
        if (resolution === 'keep-both') {
          destination = await TauriAPI.getRenameDest(targetPath, file.name);
        }
        if (resolution === 'replace') {
          try {
            await TauriAPI.removeFile(destination);
          } catch {
            // Destination may not exist anymore — continue
          }
        }
      }

      if (isCut) {
        await TauriAPI.moveWithProgress(file.path, destination);
        emitFileActivity('modified', destination, file.name, file.path);
      } else {
        await TauriAPI.copyWithProgress(file.path, destination);
        emitFileActivity('create', destination, file.name);
      }
      succeeded++;
    } catch (error) {
      const msg = `${file.name}: ${formatError(error)}`;
      errors.push(msg);
      console.error(`Paste failed for ${file.name}:`, error);
    }
    if (progressToast) {
      progressToast.update({
        id: progressToast.id,
        title: `${verb}...`,
        description: `${i + 1} / ${total} items`,
      });
    }
  }

  if (progressToast) progressToast.dismiss();
  emitFilesChanged();

  return { succeeded, errors, isCut };
}

// ── Toast helpers ────────────────────────────────────────────────────────────

/** Show a success or error toast after a paste operation completes. */
export const showPasteResultToast = (
  result: PasteResult,
  toast: (opts: {
    title?: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }) => void,
): void => {
  const verbPast = result.isCut ? 'moved' : 'copied';
  if (result.errors.length === 0) {
    toast({
      title: result.isCut ? 'Moved' : 'Copied',
      description: `${result.succeeded} item${result.succeeded > 1 ? 's' : ''} ${verbPast}`,
    });
  } else {
    toast({
      title: 'Paste completed with errors',
      description: `${result.succeeded} ${verbPast}, ${result.errors.length} failed: ${result.errors.slice(0, 3).join('; ')}${result.errors.length > 3 ? '...' : ''}`,
      variant: 'destructive',
    });
  }
};
