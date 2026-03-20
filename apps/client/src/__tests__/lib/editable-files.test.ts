import { describe, it, expect } from 'vitest';
import { EDITABLE_EXTENSIONS, getFileExtension, isEditableFile } from '@/lib/editable-files';

// ── EDITABLE_EXTENSIONS ───────────────────────────────────────────────────

describe('EDITABLE_EXTENSIONS', () => {
  it('is a Set', () => {
    expect(EDITABLE_EXTENSIONS).toBeInstanceOf(Set);
  });

  it('contains common text extensions', () => {
    expect(EDITABLE_EXTENSIONS.has('txt')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('md')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('json')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('log')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('csv')).toBe(true);
  });

  it('contains JavaScript/TypeScript extensions', () => {
    expect(EDITABLE_EXTENSIONS.has('js')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('ts')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('jsx')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('tsx')).toBe(true);
  });

  it('contains web extensions', () => {
    expect(EDITABLE_EXTENSIONS.has('html')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('css')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('xml')).toBe(true);
  });

  it('contains systems programming extensions', () => {
    expect(EDITABLE_EXTENSIONS.has('rs')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('go')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('c')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('cpp')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('h')).toBe(true);
  });

  it('contains config file extensions', () => {
    expect(EDITABLE_EXTENSIONS.has('yaml')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('yml')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('toml')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('ini')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('env')).toBe(true);
  });

  it('contains shell script extensions', () => {
    expect(EDITABLE_EXTENSIONS.has('sh')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('bash')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('zsh')).toBe(true);
  });

  it('contains special extensions', () => {
    expect(EDITABLE_EXTENSIONS.has('svg')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('gitignore')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('dockerfile')).toBe(true);
    expect(EDITABLE_EXTENSIONS.has('makefile')).toBe(true);
  });

  it('does not contain binary extensions', () => {
    expect(EDITABLE_EXTENSIONS.has('exe')).toBe(false);
    expect(EDITABLE_EXTENSIONS.has('png')).toBe(false);
    expect(EDITABLE_EXTENSIONS.has('jpg')).toBe(false);
    expect(EDITABLE_EXTENSIONS.has('zip')).toBe(false);
    expect(EDITABLE_EXTENSIONS.has('pdf')).toBe(false);
    expect(EDITABLE_EXTENSIONS.has('mp4')).toBe(false);
  });
});

// ── getFileExtension ──────────────────────────────────────────────────────

describe('getFileExtension', () => {
  it('returns extension for normal filename', () => {
    expect(getFileExtension('readme.txt')).toBe('txt');
  });

  it('returns last extension for multi-dot filename', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('gz');
  });

  it('is case-insensitive (lowercases)', () => {
    expect(getFileExtension('README.MD')).toBe('md');
  });

  it('handles dotfiles like .gitignore', () => {
    expect(getFileExtension('.gitignore')).toBe('gitignore');
  });

  it('handles dotfile .env', () => {
    expect(getFileExtension('.env')).toBe('env');
  });

  it('returns empty string for file without extension', () => {
    expect(getFileExtension('Makefile')).toBe('');
  });

  it('returns empty string for file with no extension after dot check', () => {
    expect(getFileExtension('noext')).toBe('');
  });

  it('handles dotfiles with extensions like .eslintrc.json', () => {
    // .eslintrc.json has a dot at position 0 AND a second dot, so it uses split logic
    expect(getFileExtension('.eslintrc.json')).toBe('json');
  });

  it('handles empty string', () => {
    expect(getFileExtension('')).toBe('');
  });
});

// ── isEditableFile ────────────────────────────────────────────────────────

describe('isEditableFile', () => {
  it('returns true for text files', () => {
    expect(isEditableFile({ name: 'readme.txt', is_dir: false })).toBe(true);
    expect(isEditableFile({ name: 'config.json', is_dir: false })).toBe(true);
    expect(isEditableFile({ name: 'index.ts', is_dir: false })).toBe(true);
  });

  it('returns true for markdown files', () => {
    expect(isEditableFile({ name: 'README.md', is_dir: false })).toBe(true);
  });

  it('returns true for dotfiles with editable extensions', () => {
    expect(isEditableFile({ name: '.gitignore', is_dir: false })).toBe(true);
    expect(isEditableFile({ name: '.env', is_dir: false })).toBe(true);
  });

  it('returns true for known editable filenames (case-insensitive)', () => {
    expect(isEditableFile({ name: 'Makefile', is_dir: false })).toBe(true);
    expect(isEditableFile({ name: 'Dockerfile', is_dir: false })).toBe(true);
    expect(isEditableFile({ name: 'Jenkinsfile', is_dir: false })).toBe(true);
    expect(isEditableFile({ name: 'Vagrantfile', is_dir: false })).toBe(true);
    expect(isEditableFile({ name: 'Procfile', is_dir: false })).toBe(true);
  });

  it('returns false for directories', () => {
    expect(isEditableFile({ name: 'src', is_dir: true })).toBe(false);
    expect(isEditableFile({ name: 'readme.txt', is_dir: true })).toBe(false);
  });

  it('returns false for binary files', () => {
    expect(isEditableFile({ name: 'app.exe', is_dir: false })).toBe(false);
    expect(isEditableFile({ name: 'image.png', is_dir: false })).toBe(false);
    expect(isEditableFile({ name: 'archive.zip', is_dir: false })).toBe(false);
    expect(isEditableFile({ name: 'video.mp4', is_dir: false })).toBe(false);
    expect(isEditableFile({ name: 'document.pdf', is_dir: false })).toBe(false);
  });

  it('returns false for unknown extensionless files that are not in EDITABLE_NAMES', () => {
    expect(isEditableFile({ name: 'RANDOMFILE', is_dir: false })).toBe(false);
  });

  it('handles uppercase extensions by lowering them', () => {
    expect(isEditableFile({ name: 'script.PY', is_dir: false })).toBe(true);
    expect(isEditableFile({ name: 'component.TSX', is_dir: false })).toBe(true);
  });

  it('handles files with multiple dots', () => {
    expect(isEditableFile({ name: 'data.backup.json', is_dir: false })).toBe(true);
    expect(isEditableFile({ name: 'archive.tar.gz', is_dir: false })).toBe(false);
  });
});
