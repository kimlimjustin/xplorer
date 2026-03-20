import { describe, it, expect } from 'vitest';
import { validateFileName } from '@/lib/validate-filename';

describe('validateFileName', () => {
  const existingNames = ['readme.md', 'package.json', 'src', '.gitignore'];

  describe('empty name', () => {
    it('rejects empty string', () => {
      const result = validateFileName('', existingNames, 'old.txt');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('empty');
    });

    it('rejects whitespace-only string', () => {
      const result = validateFileName('   ', existingNames, 'old.txt');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('empty');
    });
  });

  describe('invalid characters', () => {
    const invalidChars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];

    for (const char of invalidChars) {
      it(`rejects name containing "${char}"`, () => {
        const result = validateFileName(`file${char}name.txt`, existingNames, 'old.txt');
        expect(result.valid).toBe(false);
        expect(result.message).toContain('invalid characters');
      });
    }
  });

  describe('trailing dot or space', () => {
    it('rejects name ending with a dot', () => {
      const result = validateFileName('file.', existingNames, 'old.txt');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('dot or space');
    });

    it('name ending with a space is trimmed first, so trailing space is removed', () => {
      // The function trims the input, so 'file ' becomes 'file' which is valid
      const result = validateFileName('file ', existingNames, 'old.txt');
      expect(result.valid).toBe(true);
    });

    it('rejects name that is only dots and spaces (trimmed to dot)', () => {
      // '. ' trims to '.', which ends with a dot
      const result = validateFileName('. ', existingNames, 'old.txt');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('dot or space');
    });
  });

  describe('Windows reserved names', () => {
    it('rejects CON', () => {
      const result = validateFileName('CON', existingNames, 'old.txt');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('reserved');
    });

    it('rejects CON with extension', () => {
      const result = validateFileName('CON.txt', existingNames, 'old.txt');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('reserved');
    });

    it('rejects PRN case-insensitively', () => {
      const result = validateFileName('prn', existingNames, 'old.txt');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('reserved');
    });

    it('rejects AUX', () => {
      const result = validateFileName('AUX', existingNames, 'old.txt');
      expect(result.valid).toBe(false);
    });

    it('rejects NUL', () => {
      const result = validateFileName('NUL', existingNames, 'old.txt');
      expect(result.valid).toBe(false);
    });

    it('rejects COM1', () => {
      const result = validateFileName('COM1', existingNames, 'old.txt');
      expect(result.valid).toBe(false);
    });

    it('rejects LPT1', () => {
      const result = validateFileName('LPT1.txt', existingNames, 'old.txt');
      expect(result.valid).toBe(false);
    });

    it('allows names that start with reserved words but are not reserved', () => {
      // "CONVERSE.txt" should be OK because the base is "CONVERSE", not "CON"
      const result = validateFileName('CONVERSE.txt', existingNames, 'old.txt');
      expect(result.valid).toBe(true);
    });
  });

  describe('length limit', () => {
    it('rejects names longer than 255 characters', () => {
      const longName = 'a'.repeat(256);
      const result = validateFileName(longName, existingNames, 'old.txt');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('too long');
      expect(result.message).toContain('256');
    });

    it('accepts names with exactly 255 characters', () => {
      const name = 'a'.repeat(255);
      const result = validateFileName(name, [], 'old.txt');
      expect(result.valid).toBe(true);
    });
  });

  describe('name conflicts', () => {
    it('rejects name that conflicts with existing file (case-insensitive)', () => {
      const result = validateFileName('README.MD', existingNames, 'old.txt');
      expect(result.valid).toBe(false);
      expect(result.warning).toBe(true);
      expect(result.message).toContain('already exists');
    });

    it('allows same name as current (no-op rename)', () => {
      const result = validateFileName('readme.md', existingNames, 'readme.md');
      expect(result.valid).toBe(true);
      expect(result.message).toBe('');
    });

    it('allows case-only change of current name', () => {
      // Renaming 'readme.md' to 'README.md': the case-insensitive comparison
      // lowerName === lowerCurrent is true, so the conflict check is skipped entirely.
      // This allows case-only renames of the same file.
      const result = validateFileName('README.md', existingNames, 'readme.md');
      expect(result.valid).toBe(true);
    });

    it('allows name that does not conflict', () => {
      const result = validateFileName('brand-new.txt', existingNames, 'old.txt');
      expect(result.valid).toBe(true);
      expect(result.warning).toBe(false);
      expect(result.message).toBe('');
    });
  });

  describe('valid names', () => {
    it('accepts normal file names', () => {
      const result = validateFileName('document.pdf', existingNames, 'old.txt');
      expect(result.valid).toBe(true);
    });

    it('accepts names with spaces', () => {
      const result = validateFileName('my file.txt', existingNames, 'old.txt');
      expect(result.valid).toBe(true);
    });

    it('accepts names with dots', () => {
      const result = validateFileName('file.backup.tar.gz', existingNames, 'old.txt');
      expect(result.valid).toBe(true);
    });

    it('accepts hidden files', () => {
      const result = validateFileName('.env', existingNames, 'old.txt');
      expect(result.valid).toBe(true);
    });

    it('accepts names with hyphens and underscores', () => {
      const result = validateFileName('my-file_v2.txt', existingNames, 'old.txt');
      expect(result.valid).toBe(true);
    });

    it('accepts names with unicode characters', () => {
      const result = validateFileName('\u00E9l\u00E8ve-rapport.pdf', existingNames, 'old.txt');
      expect(result.valid).toBe(true);
    });
  });
});
