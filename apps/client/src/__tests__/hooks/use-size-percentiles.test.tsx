import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSizePercentiles } from '@/hooks/use-size-percentiles';
import type { FileEntry } from '@/lib/tauri-api';

const makeFile = (name: string, size: number, isDir = false): FileEntry => {
  return {
    name,
    path: `/test/${name}`,
    is_dir: isDir,
    size,
    modified: 1700000000,
    file_type: isDir ? 'directory' : 'file',
  };
};

describe('useSizePercentiles', () => {
  describe('Empty Input', () => {
    it('returns an empty map for no files', () => {
      const { result } = renderHook(() => useSizePercentiles([]));

      expect(result.current.size).toBe(0);
    });
  });

  describe('Directory Handling', () => {
    it('assigns gray color and "Folder" label to directories', () => {
      const files = [makeFile('docs', 0, true)];
      const { result } = renderHook(() => useSizePercentiles(files));

      const info = result.current.get('/test/docs');
      expect(info).toBeDefined();
      expect(info!.color).toBe('#6b7280');
      expect(info!.label).toBe('Folder');
      expect(info!.percentile).toBe(-1);
    });
  });

  describe('Zero-size Files', () => {
    it('assigns green "Small" to zero-size files', () => {
      const files = [makeFile('empty.txt', 0)];
      const { result } = renderHook(() => useSizePercentiles(files));

      const info = result.current.get('/test/empty.txt');
      expect(info).toBeDefined();
      expect(info!.color).toBe('#22c55e');
      expect(info!.label).toBe('Small');
      expect(info!.percentile).toBe(0);
    });
  });

  describe('Single File', () => {
    it('assigns 100th percentile to a single file (Largest)', () => {
      const files = [makeFile('only.txt', 5000)];
      const { result } = renderHook(() => useSizePercentiles(files));

      const info = result.current.get('/test/only.txt');
      expect(info).toBeDefined();
      expect(info!.percentile).toBe(100);
      expect(info!.color).toBe('#ef4444'); // red
      expect(info!.label).toBe('Largest');
    });
  });

  describe('Percentile Color Mapping', () => {
    it('assigns correct colors across a range of 10 files', () => {
      // Create 10 files with sizes 100 through 1000 (step 100)
      const files = Array.from({ length: 10 }, (_, i) => makeFile(`file-${i}.txt`, (i + 1) * 100));

      const { result } = renderHook(() => useSizePercentiles(files));

      // Percentiles for sorted files: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
      // file-0 (100): 10th percentile -> Small (green)
      expect(result.current.get('/test/file-0.txt')!.label).toBe('Small');
      expect(result.current.get('/test/file-0.txt')!.color).toBe('#22c55e');

      // file-1 (200): 20th percentile -> Small (green)
      expect(result.current.get('/test/file-1.txt')!.label).toBe('Small');

      // file-2 (300): 30th percentile -> Small (green)
      expect(result.current.get('/test/file-2.txt')!.label).toBe('Small');

      // file-3 (400): 40th percentile -> Small (green)
      expect(result.current.get('/test/file-3.txt')!.label).toBe('Small');

      // file-4 (500): 50th percentile -> Medium (yellow)
      expect(result.current.get('/test/file-4.txt')!.label).toBe('Medium');
      expect(result.current.get('/test/file-4.txt')!.color).toBe('#eab308');

      // file-5 (600): 60th percentile -> Medium (yellow)
      expect(result.current.get('/test/file-5.txt')!.label).toBe('Medium');

      // file-6 (700): 70th percentile -> Medium (yellow)
      expect(result.current.get('/test/file-6.txt')!.label).toBe('Medium');

      // file-7 (800): 80th percentile -> Large (orange)
      expect(result.current.get('/test/file-7.txt')!.label).toBe('Large');
      expect(result.current.get('/test/file-7.txt')!.color).toBe('#f97316');

      // file-8 (900): 90th percentile -> Largest (red)
      expect(result.current.get('/test/file-8.txt')!.label).toBe('Largest');
      expect(result.current.get('/test/file-8.txt')!.color).toBe('#ef4444');

      // file-9 (1000): 100th percentile -> Largest (red)
      expect(result.current.get('/test/file-9.txt')!.label).toBe('Largest');
      expect(result.current.get('/test/file-9.txt')!.color).toBe('#ef4444');
    });
  });

  describe('Mixed Files and Directories', () => {
    it('handles a mix of directories, zero-size files, and regular files', () => {
      const files = [
        makeFile('docs', 0, true), // directory
        makeFile('empty.log', 0), // zero-size file
        makeFile('small.txt', 100), // small file
        makeFile('medium.txt', 5000), // medium file
        makeFile('large.bin', 100000), // large file
      ];

      const { result } = renderHook(() => useSizePercentiles(files));

      // Directory
      expect(result.current.get('/test/docs')!.label).toBe('Folder');
      expect(result.current.get('/test/docs')!.color).toBe('#6b7280');

      // Zero-size
      expect(result.current.get('/test/empty.log')!.label).toBe('Small');
      expect(result.current.get('/test/empty.log')!.percentile).toBe(0);

      // 3 regular files with percentiles: 33.33, 66.67, 100
      const smallInfo = result.current.get('/test/small.txt')!;
      expect(smallInfo.label).toBe('Small');

      const mediumInfo = result.current.get('/test/medium.txt')!;
      expect(mediumInfo.label).toBe('Medium');

      const largeInfo = result.current.get('/test/large.bin')!;
      expect(largeInfo.label).toBe('Largest');
    });
  });

  describe('Percentile Calculation', () => {
    it('calculates percentile as (rank / count) * 100', () => {
      // 4 files with distinct sizes
      const files = [
        makeFile('a.txt', 10),
        makeFile('b.txt', 20),
        makeFile('c.txt', 30),
        makeFile('d.txt', 40),
      ];

      const { result } = renderHook(() => useSizePercentiles(files));

      // Sorted: a(10), b(20), c(30), d(40)
      // Percentiles: 25, 50, 75, 100
      expect(result.current.get('/test/a.txt')!.percentile).toBe(25);
      expect(result.current.get('/test/b.txt')!.percentile).toBe(50);
      expect(result.current.get('/test/c.txt')!.percentile).toBe(75);
      expect(result.current.get('/test/d.txt')!.percentile).toBe(100);
    });

    it('handles files with equal sizes correctly', () => {
      const files = [makeFile('a.txt', 500), makeFile('b.txt', 500)];

      const { result } = renderHook(() => useSizePercentiles(files));

      // Both have size 500; sorted order gives them 50th and 100th percentile
      const aInfo = result.current.get('/test/a.txt')!;
      const bInfo = result.current.get('/test/b.txt')!;

      // They should both have valid percentile info
      expect(aInfo).toBeDefined();
      expect(bInfo).toBeDefined();
      // Combined they should cover both slots
      expect([aInfo.percentile, bInfo.percentile].sort((a, b) => a - b)).toEqual([50, 100]);
    });
  });

  describe('Boundary Values', () => {
    it('handles exactly 50th percentile as Medium', () => {
      const files = [makeFile('a.txt', 10), makeFile('b.txt', 20)];

      const { result } = renderHook(() => useSizePercentiles(files));

      // a: 50th percentile -> Medium
      expect(result.current.get('/test/a.txt')!.percentile).toBe(50);
      expect(result.current.get('/test/a.txt')!.label).toBe('Medium');

      // b: 100th percentile -> Largest
      expect(result.current.get('/test/b.txt')!.percentile).toBe(100);
      expect(result.current.get('/test/b.txt')!.label).toBe('Largest');
    });

    it('handles exactly 75th percentile as Large', () => {
      const files = [
        makeFile('a.txt', 10),
        makeFile('b.txt', 20),
        makeFile('c.txt', 30),
        makeFile('d.txt', 40),
      ];

      const { result } = renderHook(() => useSizePercentiles(files));

      // c: 75th percentile -> Large
      expect(result.current.get('/test/c.txt')!.percentile).toBe(75);
      expect(result.current.get('/test/c.txt')!.label).toBe('Large');
    });

    it('handles exactly 90th percentile as Largest', () => {
      const files = Array.from({ length: 10 }, (_, i) => makeFile(`file-${i}.txt`, (i + 1) * 100));

      const { result } = renderHook(() => useSizePercentiles(files));

      // file-8 (900): 90th percentile -> Largest
      expect(result.current.get('/test/file-8.txt')!.percentile).toBe(90);
      expect(result.current.get('/test/file-8.txt')!.label).toBe('Largest');
    });
  });

  describe('Only Directories', () => {
    it('returns all Folder entries when all items are directories', () => {
      const files = [makeFile('dir1', 0, true), makeFile('dir2', 0, true)];

      const { result } = renderHook(() => useSizePercentiles(files));

      expect(result.current.size).toBe(2);
      expect(result.current.get('/test/dir1')!.label).toBe('Folder');
      expect(result.current.get('/test/dir2')!.label).toBe('Folder');
    });
  });

  describe('Memoization', () => {
    it('returns the same Map reference when files do not change', () => {
      const files = [makeFile('a.txt', 100)];
      const { result, rerender } = renderHook(
        ({ files: f }: { files: FileEntry[] }) => useSizePercentiles(f),
        { initialProps: { files } },
      );

      const firstMap = result.current;

      // Rerender with the same files reference
      rerender({ files });

      expect(result.current).toBe(firstMap);
    });
  });
});
