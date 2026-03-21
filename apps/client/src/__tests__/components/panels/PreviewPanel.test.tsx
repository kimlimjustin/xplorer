import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PreviewPanel from '@/components/panels/PreviewPanel';
import { FileEntry, FolderSizeInfo } from '@/lib/tauri-api';

// Mock preview-factory
vi.mock('@/lib/preview-factory', () => ({
  defaultPreviewFactory: {
    canPreview: vi.fn(() => false),
    getFileType: vi.fn((file: { name: string; is_dir: boolean }) => {
      if (file.is_dir) return 'folder';
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const map: Record<string, string> = {
        jpg: 'image',
        png: 'image',
        gif: 'image',
        txt: 'text',
        md: 'markdown',
        json: 'json',
        pdf: 'pdf',
        doc: 'document',
        mp4: 'video',
        mp3: 'audio',
        zip: 'archive',
      };
      return map[ext] || 'unknown';
    }),
    getPreviewComponent: vi.fn(() => Promise.resolve(null)),
  },
  PreviewProps: {},
  PreviewType: {},
}));

describe('PreviewPanel', () => {
  const mockFile: FileEntry = {
    name: 'document.txt',
    path: 'C:\\Users\\Test\\document.txt',
    size: 1024,
    is_dir: false,
    modified: Date.now(),
    file_type: 'text',
  };

  const mockFolder: FileEntry = {
    name: 'MyFolder',
    path: 'C:\\Users\\Test\\MyFolder',
    size: 0,
    is_dir: true,
    modified: Date.now(),
    file_type: 'folder',
  };

  const mockProps = {
    selectedFile: mockFile,
    formatFileSize: vi.fn((bytes: number) => `${bytes} B`),
    formatDate: vi.fn((_timestamp: number) => '2024-01-01 12:00'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('No File Selected', () => {
    it('shows empty state message when no file is selected', () => {
      render(<PreviewPanel {...mockProps} selectedFile={null} />);

      expect(screen.getByText('Select a file to preview')).toBeInTheDocument();
    });

    it('shows file icon in empty state', () => {
      const { container } = render(<PreviewPanel {...mockProps} selectedFile={null} />);

      const icon = container.querySelector('svg.w-12.h-12');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('File Properties Section', () => {
    it('displays the file name', () => {
      render(<PreviewPanel {...mockProps} />);

      // Properties section renders immediately (not debounced)
      expect(screen.getByText('document.txt')).toBeInTheDocument();
    });

    it('displays file size for non-directory files', () => {
      render(<PreviewPanel {...mockProps} />);

      expect(mockProps.formatFileSize).toHaveBeenCalledWith(1024);
    });

    it('displays "Folder" for directory files', () => {
      render(<PreviewPanel {...mockProps} selectedFile={mockFolder} />);

      expect(screen.getAllByText('Folder').length).toBeGreaterThan(0);
    });

    it('displays formatted date', () => {
      render(<PreviewPanel {...mockProps} />);

      expect(mockProps.formatDate).toHaveBeenCalledWith(mockFile.modified);
    });

    it('displays file type information', () => {
      render(<PreviewPanel {...mockProps} />);

      expect(screen.getByText('Type:')).toBeInTheDocument();
      expect(screen.getByText('File')).toBeInTheDocument();
    });

    it('displays file path', () => {
      render(<PreviewPanel {...mockProps} />);

      expect(screen.getByText('Path:')).toBeInTheDocument();
      expect(screen.getByText('C:\\Users\\Test\\document.txt')).toBeInTheDocument();
    });

    it('displays file category', () => {
      render(<PreviewPanel {...mockProps} />);

      expect(screen.getByText('Category:')).toBeInTheDocument();
    });

    it('shows copy path button', () => {
      render(<PreviewPanel {...mockProps} />);

      expect(screen.getByText('Copy')).toBeInTheDocument();
    });
  });

  describe('Properties Collapse/Expand', () => {
    it('toggles properties section visibility', () => {
      render(<PreviewPanel {...mockProps} />);

      // Properties should be visible by default
      expect(screen.getByText('Type:')).toBeInTheDocument();

      // Click the properties header to collapse
      const headerButton = screen.getByText('document.txt').closest('button');
      if (headerButton) {
        fireEvent.click(headerButton);
        // After collapsing, Type: should not be visible
        expect(screen.queryByText('Type:')).not.toBeInTheDocument();
      }
    });

    it('toggles properties open again after collapsing', () => {
      render(<PreviewPanel {...mockProps} />);

      const headerButton = screen.getByText('document.txt').closest('button');
      if (headerButton) {
        // Collapse
        fireEvent.click(headerButton);
        expect(screen.queryByText('Type:')).not.toBeInTheDocument();

        // Re-expand
        fireEvent.click(headerButton);
        expect(screen.getByText('Type:')).toBeInTheDocument();
      }
    });
  });

  describe('Folder Preview', () => {
    it('renders folder details when a folder is selected', async () => {
      const folderProps = {
        ...mockProps,
        selectedFile: mockFolder,
        getFolderSize: vi.fn(
          () =>
            ({
              total_size: 10240,
              file_count: 5,
              dir_count: 2,
              is_cached: false,
              cache_timestamp: 0,
            }) as FolderSizeInfo,
        ),
        isCalculatingSize: vi.fn(() => false),
      };

      render(<PreviewPanel {...folderProps} />);

      // Wait for debounce (200ms) + rendering
      await waitFor(
        () => {
          expect(screen.getByText('Folder Contents')).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });
  });

  describe('Unsupported File Preview', () => {
    it('shows "No preview available" for unsupported file types', async () => {
      const unknownFile: FileEntry = {
        name: 'data.xyz',
        path: 'C:\\Users\\Test\\data.xyz',
        size: 512,
        is_dir: false,
        modified: Date.now(),
        file_type: 'unknown',
      };

      render(<PreviewPanel {...mockProps} selectedFile={unknownFile} />);

      // Wait for debounce (200ms) + async preview component resolution
      await waitFor(
        () => {
          expect(screen.getByText('No preview available')).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it('shows "File is too large for preview" for very large files', async () => {
      const largeFile: FileEntry = {
        name: 'huge.bin',
        path: 'C:\\Users\\Test\\huge.bin',
        size: 100 * 1024 * 1024, // 100MB
        is_dir: false,
        modified: Date.now(),
        file_type: 'binary',
      };

      render(<PreviewPanel {...mockProps} selectedFile={largeFile} />);

      // Wait for debounce (200ms) + async preview component resolution
      await waitFor(
        () => {
          expect(screen.getByText('File is too large for preview')).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });
  });

  describe('MIME Type Display', () => {
    it('displays MIME type when available', () => {
      const fileWithMime: FileEntry = {
        ...mockFile,
        mime_type: 'text/plain',
      };

      render(<PreviewPanel {...mockProps} selectedFile={fileWithMime} />);

      expect(screen.getByText('MIME Type:')).toBeInTheDocument();
      expect(screen.getByText('text/plain')).toBeInTheDocument();
    });

    it('does not display MIME type when not available', () => {
      render(<PreviewPanel {...mockProps} />);

      expect(screen.queryByText('MIME Type:')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles file with zero size', () => {
      const emptyFile: FileEntry = {
        ...mockFile,
        size: 0,
      };

      expect(() => render(<PreviewPanel {...mockProps} selectedFile={emptyFile} />)).not.toThrow();
    });

    it('handles file with very long name', () => {
      const longNameFile: FileEntry = {
        ...mockFile,
        name: `${'a'.repeat(200)}.txt`,
      };

      expect(() =>
        render(<PreviewPanel {...mockProps} selectedFile={longNameFile} />),
      ).not.toThrow();
    });

    it('handles switching from file to null', () => {
      const { rerender } = render(<PreviewPanel {...mockProps} />);

      rerender(<PreviewPanel {...mockProps} selectedFile={null} />);

      expect(screen.getByText('Select a file to preview')).toBeInTheDocument();
    });

    it('handles switching between different files', () => {
      const { rerender } = render(<PreviewPanel {...mockProps} />);

      const newFile: FileEntry = {
        name: 'other.txt',
        path: 'C:\\Users\\Test\\other.txt',
        size: 2048,
        is_dir: false,
        modified: Date.now(),
        file_type: 'text',
      };

      rerender(<PreviewPanel {...mockProps} selectedFile={newFile} />);

      // The properties section updates immediately (not debounced)
      // Use getAllByText since the name may appear in both header and path
      expect(screen.getAllByText('other.txt').length).toBeGreaterThan(0);
    });
  });
});
