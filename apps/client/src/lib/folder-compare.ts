/**
 * Folder comparison utility.
 *
 * Compares the immediate children of two directories by filename,
 * classifying entries as identical, different, or unique to one side.
 */

import { TauriAPI, type FileEntry } from '@/lib/tauri-api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FolderFileInfo {
  name: string;
  path: string;
  size: number;
  modifiedAt: number;
}

export interface DifferentFileInfo {
  name: string;
  leftPath: string;
  rightPath: string;
  leftSize: number;
  rightSize: number;
  leftModified: number;
  rightModified: number;
}

export interface IdenticalFileInfo {
  name: string;
  leftPath: string;
  rightPath: string;
  size: number;
}

export interface FolderCompareSummary {
  totalLeft: number;
  totalRight: number;
  onlyLeft: number;
  onlyRight: number;
  different: number;
  identical: number;
}

export interface FolderCompareResult {
  onlyInLeft: FolderFileInfo[];
  onlyInRight: FolderFileInfo[];
  different: DifferentFileInfo[];
  identical: IdenticalFileInfo[];
  summary: FolderCompareSummary;
}

// ── Implementation ───────────────────────────────────────────────────────────

const toMap = (entries: FileEntry[]): Map<string, FileEntry> => {
  const m = new Map<string, FileEntry>();
  for (const e of entries) {
    m.set(e.name, e);
  }
  return m;
};

/**
 * Compare the immediate children of two folders.
 *
 * - Files with the same name and same size are considered "identical".
 * - Files with the same name but different size or mtime are "different".
 * - Files present in only one side are "onlyInLeft" / "onlyInRight".
 */
export async function compareFolders(
  leftPath: string,
  rightPath: string,
): Promise<FolderCompareResult> {
  const [leftEntries, rightEntries] = await Promise.all([
    TauriAPI.readDirectory(leftPath),
    TauriAPI.readDirectory(rightPath),
  ]);

  const leftMap = toMap(leftEntries);
  const rightMap = toMap(rightEntries);

  const onlyInLeft: FolderFileInfo[] = [];
  const onlyInRight: FolderFileInfo[] = [];
  const different: DifferentFileInfo[] = [];
  const identical: IdenticalFileInfo[] = [];

  // Walk left entries
  for (const [name, lEntry] of leftMap) {
    const rEntry = rightMap.get(name);
    if (!rEntry) {
      onlyInLeft.push({
        name,
        path: lEntry.path,
        size: lEntry.size,
        modifiedAt: lEntry.modified,
      });
    } else if (lEntry.size !== rEntry.size) {
      different.push({
        name,
        leftPath: lEntry.path,
        rightPath: rEntry.path,
        leftSize: lEntry.size,
        rightSize: rEntry.size,
        leftModified: lEntry.modified,
        rightModified: rEntry.modified,
      });
    } else {
      // Same name, same size => identical
      identical.push({
        name,
        leftPath: lEntry.path,
        rightPath: rEntry.path,
        size: lEntry.size,
      });
    }
  }

  // Walk right entries for items not in left
  for (const [name, rEntry] of rightMap) {
    if (!leftMap.has(name)) {
      onlyInRight.push({
        name,
        path: rEntry.path,
        size: rEntry.size,
        modifiedAt: rEntry.modified,
      });
    }
  }

  // Sort each group by name for deterministic output
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  onlyInLeft.sort(byName);
  onlyInRight.sort(byName);
  different.sort(byName);
  identical.sort(byName);

  return {
    onlyInLeft,
    onlyInRight,
    different,
    identical,
    summary: {
      totalLeft: leftEntries.length,
      totalRight: rightEntries.length,
      onlyLeft: onlyInLeft.length,
      onlyRight: onlyInRight.length,
      different: different.length,
      identical: identical.length,
    },
  };
}
