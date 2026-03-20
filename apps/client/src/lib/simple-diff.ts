/**
 * Lightweight line-by-line diff utility using a basic LCS (Longest Common Subsequence) algorithm.
 * No external dependencies. Designed for preview-quality comparison, not production-grade patching.
 */

export interface DiffLine {
  type: 'same' | 'added' | 'removed';
  content: string;
  lineNumber: { left?: number; right?: number };
}

/**
 * Compute the LCS table for two arrays of strings.
 * Returns a 2D array where lcs[i][j] = length of LCS of left[0..i-1] and right[0..j-1].
 */
const buildLcsTable = (left: string[], right: string[]) : number[][] => {
  const m = left.length;
  const n = right.length;

  // For very large files, cap to avoid memory issues
  const MAX_LINES = 5000;
  if (m > MAX_LINES || n > MAX_LINES) {
    // Return empty table — caller will fall back to simple comparison
    return [];
  }

  const table: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (left[i - 1] === right[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  return table;
}

/**
 * Backtrack through the LCS table to produce a diff.
 */
const backtrackDiff = (table: number[][], left: string[], right: string[]) : DiffLine[] => {
  const result: DiffLine[] = [];
  let i = left.length;
  let j = right.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && left[i - 1] === right[j - 1]) {
      result.push({
        type: 'same',
        content: left[i - 1],
        lineNumber: { left: i, right: j },
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      result.push({
        type: 'added',
        content: right[j - 1],
        lineNumber: { right: j },
      });
      j--;
    } else if (i > 0) {
      result.push({
        type: 'removed',
        content: left[i - 1],
        lineNumber: { left: i },
      });
      i--;
    }
  }

  return result.reverse();
}

/**
 * Simple fallback diff for very large files: marks every line as removed then added.
 */
const simpleFallbackDiff = (left: string[], right: string[]) : DiffLine[] => {
  const result: DiffLine[] = [];
  const maxLen = Math.max(left.length, right.length);

  for (let i = 0; i < maxLen; i++) {
    const leftLine = i < left.length ? left[i] : undefined;
    const rightLine = i < right.length ? right[i] : undefined;

    if (leftLine !== undefined && rightLine !== undefined && leftLine === rightLine) {
      result.push({
        type: 'same',
        content: leftLine,
        lineNumber: { left: i + 1, right: i + 1 },
      });
    } else {
      if (leftLine !== undefined) {
        result.push({
          type: 'removed',
          content: leftLine,
          lineNumber: { left: i + 1 },
        });
      }
      if (rightLine !== undefined) {
        result.push({
          type: 'added',
          content: rightLine,
          lineNumber: { right: i + 1 },
        });
      }
    }
  }

  return result;
}

/**
 * Compute a line-by-line diff between two text strings.
 *
 * @param leftText  - Content of the "left" (original) file
 * @param rightText - Content of the "right" (modified) file
 * @returns Array of DiffLine objects describing the diff
 */
export const computeLineDiff = (leftText: string, rightText: string) : DiffLine[] => {
  const leftLines = leftText.split('\n');
  const rightLines = rightText.split('\n');

  // Build LCS table
  const table = buildLcsTable(leftLines, rightLines);

  // If files were too large for LCS, use simple fallback
  if (table.length === 0) {
    return simpleFallbackDiff(leftLines, rightLines);
  }

  return backtrackDiff(table, leftLines, rightLines);
}

/**
 * Compute diff statistics from a diff result.
 */
export const getDiffStats = (diff: DiffLine[]): {
  additions: number;
  removals: number;
  unchanged: number;
} => {
  let additions = 0;
  let removals = 0;
  let unchanged = 0;

  for (const line of diff) {
    switch (line.type) {
      case 'added':
        additions++;
        break;
      case 'removed':
        removals++;
        break;
      case 'same':
        unchanged++;
        break;
    }
  }

  return { additions, removals, unchanged };
}
