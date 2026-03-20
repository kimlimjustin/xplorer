import { describe, it, expect } from 'vitest';
import { computeLineDiff, getDiffStats, type DiffLine } from '@/lib/simple-diff';

describe('simple-diff', () => {
  describe('computeLineDiff', () => {
    it('returns all "same" lines for identical content', () => {
      const text = 'line 1\nline 2\nline 3';
      const diff = computeLineDiff(text, text);

      expect(diff.every((d) => d.type === 'same')).toBe(true);
      expect(diff).toHaveLength(3);
    });

    it('detects added lines', () => {
      const left = 'line 1\nline 2';
      const right = 'line 1\nline 2\nline 3';
      const diff = computeLineDiff(left, right);

      const added = diff.filter((d) => d.type === 'added');
      expect(added).toHaveLength(1);
      expect(added[0].content).toBe('line 3');
    });

    it('detects removed lines', () => {
      const left = 'line 1\nline 2\nline 3';
      const right = 'line 1\nline 3';
      const diff = computeLineDiff(left, right);

      const removed = diff.filter((d) => d.type === 'removed');
      expect(removed).toHaveLength(1);
      expect(removed[0].content).toBe('line 2');
    });

    it('detects changed lines as removed + added', () => {
      const left = 'hello world';
      const right = 'hello universe';
      const diff = computeLineDiff(left, right);

      const removed = diff.filter((d) => d.type === 'removed');
      const added = diff.filter((d) => d.type === 'added');
      expect(removed).toHaveLength(1);
      expect(removed[0].content).toBe('hello world');
      expect(added).toHaveLength(1);
      expect(added[0].content).toBe('hello universe');
    });

    it('handles empty left text', () => {
      const diff = computeLineDiff('', 'new content');
      const added = diff.filter((d) => d.type === 'added');
      expect(added.length).toBeGreaterThan(0);
    });

    it('handles empty right text', () => {
      const diff = computeLineDiff('old content', '');
      const removed = diff.filter((d) => d.type === 'removed');
      expect(removed.length).toBeGreaterThan(0);
    });

    it('handles both empty', () => {
      const diff = computeLineDiff('', '');
      expect(diff).toHaveLength(1); // single empty string line
      expect(diff[0].type).toBe('same');
    });

    it('tracks line numbers correctly', () => {
      const left = 'a\nb\nc';
      const right = 'a\nc';
      const diff = computeLineDiff(left, right);

      const sameLinesA = diff.filter((d) => d.type === 'same' && d.content === 'a');
      expect(sameLinesA).toHaveLength(1);
      expect(sameLinesA[0].lineNumber.left).toBe(1);
      expect(sameLinesA[0].lineNumber.right).toBe(1);

      const sameLinesC = diff.filter((d) => d.type === 'same' && d.content === 'c');
      expect(sameLinesC).toHaveLength(1);
      expect(sameLinesC[0].lineNumber.left).toBe(3);
      expect(sameLinesC[0].lineNumber.right).toBe(2);
    });

    it('handles complex multi-line diff', () => {
      const left = 'function foo() {\n  return 1;\n}\n\nfunction bar() {\n  return 2;\n}';
      const right = 'function foo() {\n  return 42;\n}\n\nfunction baz() {\n  return 3;\n}';
      const diff = computeLineDiff(left, right);

      // Function signatures should remain
      const same = diff.filter((d) => d.type === 'same');
      expect(same.some((d) => d.content === 'function foo() {')).toBe(true);
      expect(same.some((d) => d.content === '}')).toBe(true);

      // Changed lines should appear as removed+added
      const removed = diff.filter((d) => d.type === 'removed');
      const added = diff.filter((d) => d.type === 'added');
      expect(removed.length).toBeGreaterThan(0);
      expect(added.length).toBeGreaterThan(0);
    });

    it('preserves order of diff lines', () => {
      const left = 'a\nb\nc';
      const right = 'a\nx\nc';
      const diff = computeLineDiff(left, right);

      // First line should be 'same' (a)
      expect(diff[0].type).toBe('same');
      expect(diff[0].content).toBe('a');

      // Last line should be 'same' (c)
      expect(diff[diff.length - 1].type).toBe('same');
      expect(diff[diff.length - 1].content).toBe('c');
    });

    it('handles large files by falling back to simple diff', () => {
      // Create content with > 5000 lines
      const lines = Array.from({ length: 5001 }, (_, i) => `line ${i}`);
      const left = lines.join('\n');
      const right = lines.join('\n');

      const diff = computeLineDiff(left, right);
      // Should still produce a result (fallback diff)
      expect(diff.length).toBeGreaterThan(0);
      // All should be 'same' since content is identical
      expect(diff.every((d) => d.type === 'same')).toBe(true);
    });
  });

  describe('getDiffStats', () => {
    it('counts additions, removals, and unchanged lines', () => {
      const diff: DiffLine[] = [
        { type: 'same', content: 'a', lineNumber: { left: 1, right: 1 } },
        { type: 'removed', content: 'b', lineNumber: { left: 2 } },
        { type: 'added', content: 'c', lineNumber: { right: 2 } },
        { type: 'added', content: 'd', lineNumber: { right: 3 } },
        { type: 'same', content: 'e', lineNumber: { left: 3, right: 4 } },
      ];

      const stats = getDiffStats(diff);
      expect(stats.additions).toBe(2);
      expect(stats.removals).toBe(1);
      expect(stats.unchanged).toBe(2);
    });

    it('returns zeros for empty diff', () => {
      const stats = getDiffStats([]);
      expect(stats.additions).toBe(0);
      expect(stats.removals).toBe(0);
      expect(stats.unchanged).toBe(0);
    });

    it('handles all same lines', () => {
      const diff: DiffLine[] = [
        { type: 'same', content: 'x', lineNumber: { left: 1, right: 1 } },
        { type: 'same', content: 'y', lineNumber: { left: 2, right: 2 } },
      ];
      const stats = getDiffStats(diff);
      expect(stats.additions).toBe(0);
      expect(stats.removals).toBe(0);
      expect(stats.unchanged).toBe(2);
    });

    it('handles all additions', () => {
      const diff: DiffLine[] = [
        { type: 'added', content: 'a', lineNumber: { right: 1 } },
        { type: 'added', content: 'b', lineNumber: { right: 2 } },
      ];
      const stats = getDiffStats(diff);
      expect(stats.additions).toBe(2);
      expect(stats.removals).toBe(0);
      expect(stats.unchanged).toBe(0);
    });

    it('integrates with computeLineDiff', () => {
      const diff = computeLineDiff('a\nb\nc', 'a\nx\nc');
      const stats = getDiffStats(diff);
      expect(stats.unchanged).toBe(2); // 'a' and 'c'
      expect(stats.removals).toBe(1); // 'b'
      expect(stats.additions).toBe(1); // 'x'
    });
  });
});
