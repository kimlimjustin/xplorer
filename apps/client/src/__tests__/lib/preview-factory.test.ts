import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreviewFactory, defaultPreviewFactory, type PreviewType, type PreviewCapability } from '@/lib/preview-factory';
import type { FileEntry } from '@/lib/tauri-api';

// Mock all the dynamic imports that preview-factory uses
vi.mock('@/components/previews/ImagePreview', () => ({ default: () => null }));
vi.mock('@/components/previews/PdfPreview', () => ({ default: () => null }));
vi.mock('@/components/previews/DocumentPreview', () => ({ default: () => null }));
vi.mock('@/components/previews/SpreadsheetPreview', () => ({ default: () => null }));
vi.mock('@/components/previews/TextPreview', () => ({ default: () => null }));
vi.mock('@/components/previews/CodePreview', () => ({ default: () => null }));
vi.mock('@/components/previews/CsvPreview', () => ({ default: () => null }));
vi.mock('@/components/previews/JsonPreview', () => ({ default: () => null }));
vi.mock('@/components/previews/MarkdownPreview', () => ({ default: () => null }));
vi.mock('@/components/previews/VideoPreview', () => ({ default: () => null }));
vi.mock('@/components/previews/AudioPreview', () => ({ default: () => null }));

const makeFile = (name: string, overrides: Partial<FileEntry> = {}): FileEntry => {
  return {
    name,
    path: `/home/user/${name}`,
    is_dir: false,
    size: 1000,
    modified: Date.now(),
    file_type: 'file',
    ...overrides,
  };
};

describe('PreviewFactory', () => {
  let factory: PreviewFactory;

  beforeEach(() => {
    factory = new PreviewFactory();
  });

  describe('getFileType', () => {
    // Image types
    it.each(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff'])(
      'identifies .%s as image',
      (ext) => {
        expect(factory.getFileType(makeFile(`photo.${ext}`))).toBe('image');
      },
    );

    // PDF
    it('identifies .pdf as pdf', () => {
      expect(factory.getFileType(makeFile('doc.pdf'))).toBe('pdf');
    });

    // Document types
    it.each(['docx', 'doc', 'odt', 'rtf'])('identifies .%s as document', (ext) => {
      expect(factory.getFileType(makeFile(`file.${ext}`))).toBe('document');
    });

    // Spreadsheet types
    it.each(['xlsx', 'xls', 'ods'])('identifies .%s as spreadsheet', (ext) => {
      expect(factory.getFileType(makeFile(`data.${ext}`))).toBe('spreadsheet');
    });

    // Text types
    it.each(['txt', 'log', 'ini', 'cfg', 'conf'])('identifies .%s as text', (ext) => {
      expect(factory.getFileType(makeFile(`readme.${ext}`))).toBe('text');
    });

    // Code types
    it.each(['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'html', 'css', 'scss', 'less', 'vue', 'svelte'])(
      'identifies .%s as code',
      (ext) => {
        expect(factory.getFileType(makeFile(`app.${ext}`))).toBe('code');
      },
    );

    // CSV/TSV
    it('identifies .csv as csv', () => {
      expect(factory.getFileType(makeFile('data.csv'))).toBe('csv');
    });

    it('identifies .tsv as csv', () => {
      expect(factory.getFileType(makeFile('data.tsv'))).toBe('csv');
    });

    // JSON
    it.each(['json', 'jsonl', 'ndjson'])('identifies .%s as json', (ext) => {
      expect(factory.getFileType(makeFile(`config.${ext}`))).toBe('json');
    });

    // Markdown
    it.each(['md', 'markdown', 'mdown', 'mkd'])('identifies .%s as markdown', (ext) => {
      expect(factory.getFileType(makeFile(`README.${ext}`))).toBe('markdown');
    });

    // Video types
    it.each(['mp4', 'webm', 'mkv', 'avi', 'mov', 'm4v', 'ogv'])('identifies .%s as video', (ext) => {
      expect(factory.getFileType(makeFile(`clip.${ext}`))).toBe('video');
    });

    // Audio types
    it.each(['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus', 'aiff'])(
      'identifies .%s as audio',
      (ext) => {
        expect(factory.getFileType(makeFile(`song.${ext}`))).toBe('audio');
      },
    );

    // Folders
    it('identifies directories as folder', () => {
      expect(factory.getFileType(makeFile('mydir', { is_dir: true }))).toBe('folder');
    });

    // Unknown
    it('returns unknown for unrecognized extensions', () => {
      expect(factory.getFileType(makeFile('file.xyz'))).toBe('unknown');
    });

    // MIME type fallback
    it('identifies by mime_type when extension does not match', () => {
      const file = makeFile('noext', { mime_type: 'image/png' });
      expect(factory.getFileType(file)).toBe('image');
    });

    it('uses mime_type for code detection (text/*)', () => {
      const file = makeFile('file.unknown', { mime_type: 'text/x-python' });
      expect(factory.getFileType(file)).toBe('code');
    });
  });

  describe('canPreview', () => {
    it('returns true for previewable files', () => {
      expect(factory.canPreview(makeFile('photo.jpg'))).toBe(true);
      expect(factory.canPreview(makeFile('doc.pdf'))).toBe(true);
      expect(factory.canPreview(makeFile('app.ts'))).toBe(true);
    });

    it('returns false for directories', () => {
      expect(factory.canPreview(makeFile('dir', { is_dir: true }))).toBe(false);
    });

    it('returns false for unknown file types', () => {
      expect(factory.canPreview(makeFile('file.xyz123'))).toBe(false);
    });

    it('returns false for files exceeding maxFileSize', () => {
      const bigFile = makeFile('huge.jpg', { size: 100 * 1024 * 1024 }); // 100MB > 50MB default
      expect(factory.canPreview(bigFile)).toBe(false);
    });

    it('respects custom maxFileSize configuration', () => {
      const smallFactory = new PreviewFactory({ maxFileSize: 500 });
      const file = makeFile('small.txt', { size: 1000 });
      expect(smallFactory.canPreview(file)).toBe(false);
    });
  });

  describe('getPreviewComponent', () => {
    it('returns a component for previewable files', async () => {
      const component = await factory.getPreviewComponent(makeFile('photo.jpg'));
      expect(component).toBeDefined();
    });

    it('returns null for unknown file types', async () => {
      const component = await factory.getPreviewComponent(makeFile('file.xyz'));
      expect(component).toBeNull();
    });

    it('returns null for directories', async () => {
      const component = await factory.getPreviewComponent(makeFile('dir', { is_dir: true }));
      expect(component).toBeNull();
    });
  });

  describe('registerPreview', () => {
    it('registers a custom preview capability', () => {
      const customCapability: PreviewCapability = {
        type: 'code' as PreviewType, // Override code
        extensions: ['custom'],
        priority: 100,
        canPreview: (file) => file.name.endsWith('.custom'),
        getPreviewComponent: () => Promise.resolve(() => null),
      };

      factory.registerPreview(customCapability);

      // The custom extension should now be recognized
      const file = makeFile('test.custom');
      expect(factory.getFileType(file)).toBe('code');
    });
  });

  describe('unregisterPreview', () => {
    it('removes a preview capability', () => {
      factory.unregisterPreview('image');

      // Image files should now be unknown
      expect(factory.getFileType(makeFile('photo.jpg'))).not.toBe('image');
    });
  });

  describe('custom config', () => {
    it('respects enabledTypes configuration', () => {
      const limitedFactory = new PreviewFactory({
        enabledTypes: ['image', 'pdf'],
      });

      expect(limitedFactory.getFileType(makeFile('photo.jpg'))).toBe('image');
      expect(limitedFactory.getFileType(makeFile('doc.pdf'))).toBe('pdf');
      // Code is not in enabledTypes, so it becomes unknown
      expect(limitedFactory.getFileType(makeFile('app.ts'))).toBe('unknown');
    });
  });

  describe('defaultPreviewFactory', () => {
    it('is a PreviewFactory instance', () => {
      expect(defaultPreviewFactory).toBeInstanceOf(PreviewFactory);
    });

    it('can identify common file types', () => {
      expect(defaultPreviewFactory.getFileType(makeFile('image.png'))).toBe('image');
      expect(defaultPreviewFactory.getFileType(makeFile('doc.pdf'))).toBe('pdf');
      expect(defaultPreviewFactory.getFileType(makeFile('app.js'))).toBe('code');
      expect(defaultPreviewFactory.getFileType(makeFile('data.json'))).toBe('json');
    });
  });

  describe('priority handling', () => {
    it('csv has higher priority than spreadsheet for .csv files', () => {
      // CSV capability has priority 10, spreadsheet has priority 9
      // csv includes 'csv' in its extensions, and spreadsheet also includes 'csv'
      // CSV should win because it has higher priority
      const result = factory.getFileType(makeFile('data.csv'));
      expect(result).toBe('csv');
    });
  });
});
