import { describe, it, expect } from 'vitest';
import {
  serializeDragData,
  deserializeDragData,
  isDescendantPath,
  validateDrop,
  buildDestinationPath,
  getParentPath,
  XPLORER_DND_MIME,
} from '@/lib/drag-utils';
import type { FileEntry } from '@/lib/tauri-api';

describe('drag-utils', () => {
  describe('serializeDragData', () => {
    it('serializes file entries to JSON', () => {
      const files: FileEntry[] = [
        {
          name: 'doc.txt',
          path: 'C:\\Users\\Test\\doc.txt',
          size: 100,
          is_dir: false,
          modified: Date.now(),
          file_type: 'text',
        },
      ];

      const result = serializeDragData(files);
      const parsed = JSON.parse(result);

      expect(parsed).toEqual([
        { path: 'C:\\Users\\Test\\doc.txt', name: 'doc.txt', is_dir: false },
      ]);
    });

    it('serializes multiple files correctly', () => {
      const files: FileEntry[] = [
        {
          name: 'folder1',
          path: '/home/user/folder1',
          size: 0,
          is_dir: true,
          modified: Date.now(),
          file_type: 'folder',
        },
        {
          name: 'file.txt',
          path: '/home/user/file.txt',
          size: 200,
          is_dir: false,
          modified: Date.now(),
          file_type: 'text',
        },
      ];

      const result = serializeDragData(files);
      const parsed = JSON.parse(result);

      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe('folder1');
      expect(parsed[0].is_dir).toBe(true);
      expect(parsed[1].name).toBe('file.txt');
      expect(parsed[1].is_dir).toBe(false);
    });

    it('only includes path, name, and is_dir fields', () => {
      const files: FileEntry[] = [
        {
          name: 'test.txt',
          path: '/test.txt',
          size: 999,
          is_dir: false,
          modified: 12345,
          file_type: 'text',
        },
      ];

      const result = serializeDragData(files);
      const parsed = JSON.parse(result);

      expect(Object.keys(parsed[0])).toEqual(['path', 'name', 'is_dir']);
    });
  });

  describe('deserializeDragData', () => {
    it('deserializes valid drag data', () => {
      const data = JSON.stringify([{ path: '/home/user/doc.txt', name: 'doc.txt', is_dir: false }]);

      const result = deserializeDragData(data);

      expect(result).toEqual([{ path: '/home/user/doc.txt', name: 'doc.txt', is_dir: false }]);
    });

    it('handles corrupted/invalid JSON gracefully', () => {
      const result = deserializeDragData('not valid json {{{');
      expect(result).toEqual([]);
    });

    it('handles empty string gracefully', () => {
      const result = deserializeDragData('');
      expect(result).toEqual([]);
    });

    it('returns empty array for non-array JSON', () => {
      const result = deserializeDragData('{"key": "value"}');
      expect(result).toEqual([]);
    });

    it('returns empty array for JSON string value', () => {
      const result = deserializeDragData('"just a string"');
      expect(result).toEqual([]);
    });

    it('returns empty array for JSON number value', () => {
      const result = deserializeDragData('42');
      expect(result).toEqual([]);
    });

    it('validates that deserialized items have required fields', () => {
      const data = JSON.stringify([
        { path: '/file.txt', name: 'file.txt', is_dir: false },
        { unrelated: 'data' },
        { path: '/folder', name: 'folder', is_dir: true },
        null,
        42,
        'string',
      ]);

      const result = deserializeDragData(data);

      // Should only include items that have 'path' and 'name'
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('file.txt');
      expect(result[1].name).toBe('folder');
    });

    it('round-trips with serializeDragData', () => {
      const files: FileEntry[] = [
        {
          name: 'test.txt',
          path: '/home/user/test.txt',
          size: 100,
          is_dir: false,
          modified: Date.now(),
          file_type: 'text',
        },
      ];

      const serialized = serializeDragData(files);
      const deserialized = deserializeDragData(serialized);

      expect(deserialized).toEqual([
        { path: '/home/user/test.txt', name: 'test.txt', is_dir: false },
      ]);
    });
  });

  describe('isDescendantPath', () => {
    it('returns true when child is inside parent', () => {
      expect(isDescendantPath('/home/user', '/home/user/docs')).toBe(true);
    });

    it('returns false when child equals parent', () => {
      expect(isDescendantPath('/home/user', '/home/user')).toBe(false);
    });

    it('returns false when child is not inside parent', () => {
      expect(isDescendantPath('/home/user', '/home/other')).toBe(false);
    });

    it('handles Windows paths', () => {
      expect(isDescendantPath('C:\\Users\\Test', 'C:\\Users\\Test\\Documents')).toBe(true);
    });

    it('handles trailing slashes', () => {
      expect(isDescendantPath('/home/user/', '/home/user/docs')).toBe(true);
    });
  });

  describe('validateDrop', () => {
    it('returns invalid when dropping onto self', () => {
      const result = validateDrop(['/home/file.txt'], '/home/file.txt');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('itself');
    });

    it('returns invalid when dropping folder into own descendant', () => {
      const result = validateDrop(['/home/folder'], '/home/folder/sub');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('subfolder');
    });

    it('returns invalid when files are already in target', () => {
      const result = validateDrop(['/home/docs/file.txt'], '/home/docs');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('already');
    });

    it('returns valid for a legitimate drop', () => {
      const result = validateDrop(['/home/docs/file.txt'], '/home/other');
      expect(result.valid).toBe(true);
    });
  });

  describe('buildDestinationPath', () => {
    it('builds correct destination path', () => {
      const result = buildDestinationPath('/home/file.txt', '/home/target');
      expect(result).toBe('/home/target/file.txt');
    });

    it('handles Windows paths', () => {
      const result = buildDestinationPath('C:\\Users\\file.txt', 'C:\\Users\\target');
      expect(result).toBe('C:\\Users\\target\\file.txt');
    });

    it('handles trailing slashes on target', () => {
      const result = buildDestinationPath('/home/file.txt', '/home/target/');
      expect(result).toBe('/home/target/file.txt');
    });
  });

  describe('getParentPath', () => {
    it('returns parent directory', () => {
      expect(getParentPath('/home/user/file.txt')).toBe('/home/user');
    });

    it('returns root for top-level file', () => {
      expect(getParentPath('/file.txt')).toBe('/');
    });

    it('handles Windows paths', () => {
      expect(getParentPath('C:\\Users\\Test\\file.txt')).toBe('C:/Users/Test');
    });
  });

  describe('XPLORER_DND_MIME', () => {
    it('has the correct MIME type', () => {
      expect(XPLORER_DND_MIME).toBe('application/x-xplorer-files');
    });
  });
});
