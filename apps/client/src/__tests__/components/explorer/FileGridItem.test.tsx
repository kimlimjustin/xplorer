import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FileGridItem from '@/components/explorer/FileGridItem';
import type { FileEntry } from '@/lib/tauri-api';

// Mock dependencies
vi.mock('@/hooks/use-draggable', () => ({
  useDraggable: () => ({
    onMouseDown: vi.fn(),
    onMouseMove: vi.fn(),
    onMouseUp: vi.fn(),
  }),
}));
vi.mock('@/hooks/use-droppable', () => ({
  useDroppable: () => () => {},
}));
vi.mock('@/components/explorer/FileGridHelpers', () => ({
  TagDots: ({ tags }: { tags?: string[] }) =>
    tags && tags.length > 0 ? <span data-testid="tag-dots">{tags.length} tags</span> : null,
  GitStatusDot: ({ status }: { status?: string }) =>
    status ? <span data-testid="git-status">{status}</span> : null,
  isImageFile: () => false,
}));
vi.mock('@/lib/utils', () => ({
  formatFileSize: (bytes: number) => `${bytes} B`,
}));
vi.mock('@/lib/folder-colors', () => ({
  getFolderColorHex: () => null,
}));
vi.mock('@/lib/validate-filename', () => ({
  validateFileName: (value: string, existing: string[], original: string) => ({
    valid: value.length > 0 && value !== original,
    warning: false,
    message: '',
  }),
}));
vi.mock('@/components/explorer/ThumbnailPreview', () => ({
  default: () => null,
}));

describe('FileGridItem', () => {
  const mockOnFileClick = vi.fn();
  const mockOnFileDoubleClick = vi.fn();
  const mockOnFileRightClick = vi.fn();
  const mockGetFolderSize = vi.fn(() => null);
  const mockIsCalculatingSize = vi.fn(() => false);

  const sampleFile: FileEntry = {
    name: 'document.txt',
    path: 'C:\\Users\\Test\\document.txt',
    size: 2048,
    is_dir: false,
    modified: 1710000000,
    file_type: 'text',
  };

  const sampleFolder: FileEntry = {
    name: 'Projects',
    path: 'C:\\Users\\Test\\Projects',
    size: 0,
    is_dir: true,
    modified: 1710001000,
    file_type: 'folder',
  };

  const defaultProps = {
    file: sampleFile,
    isSelected: false,
    tags: [],
    gitStatus: null,
    isGridView: true,
    isListView: false,
    viewMode: 'grid',
    itemSize: 'text-3xl',
    selectedFiles: new Set<string>(),
    allFiles: [sampleFile],
    getFileIcon: (file: FileEntry) => <span data-testid={`file-icon-${file.name}`}>icon</span>,
    formatFileSize: (bytes: number) => `${bytes} B`,
    formatFolderSize: (info: unknown, isCalc?: boolean) => {
      if (isCalc) return 'Calculating...';
      return info ? '1 MB' : '';
    },
    formatDate: (_ts: number) => 'Mar 2025',
    onFileClick: mockOnFileClick,
    onFileDoubleClick: mockOnFileDoubleClick,
    onFileRightClick: mockOnFileRightClick,
    getFolderSize: mockGetFolderSize,
    isCalculatingSize: mockIsCalculatingSize,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders file name', () => {
      render(<FileGridItem {...defaultProps} />);
      expect(screen.getByText('document.txt')).toBeInTheDocument();
    });

    it('renders file icon', () => {
      render(<FileGridItem {...defaultProps} />);
      expect(screen.getByTestId('file-icon-document.txt')).toBeInTheDocument();
    });

    it('renders with correct role and aria-label for file', () => {
      render(<FileGridItem {...defaultProps} />);
      const item = screen.getByRole('option');
      expect(item).toHaveAttribute('aria-label', 'document.txt, file');
    });

    it('renders with correct aria-label for folder', () => {
      render(<FileGridItem {...defaultProps} file={sampleFolder} />);
      const item = screen.getByRole('option');
      expect(item).toHaveAttribute('aria-label', 'Projects, folder');
    });

    it('renders data-file-path attribute', () => {
      render(<FileGridItem {...defaultProps} />);
      const item = screen.getByRole('option');
      expect(item).toHaveAttribute('data-file-path', 'C:\\Users\\Test\\document.txt');
    });
  });

  describe('Selected state', () => {
    it('applies selected styling when isSelected is true', () => {
      render(<FileGridItem {...defaultProps} isSelected={true} />);
      const item = screen.getByRole('option');
      expect(item).toHaveAttribute('aria-selected', 'true');
      expect(item.className).toContain('bg-xp-blue');
    });

    it('does not apply selected styling when isSelected is false', () => {
      render(<FileGridItem {...defaultProps} isSelected={false} />);
      const item = screen.getByRole('option');
      expect(item).toHaveAttribute('aria-selected', 'false');
      expect(item.className).not.toContain('bg-xp-blue/20');
    });
  });

  describe('Click interactions', () => {
    it('calls onFileClick on single click', () => {
      render(<FileGridItem {...defaultProps} />);
      const item = screen.getByRole('option');
      fireEvent.click(item);
      expect(mockOnFileClick).toHaveBeenCalledWith(sampleFile, expect.any(Object));
    });

    it('calls onFileDoubleClick on double click', () => {
      render(<FileGridItem {...defaultProps} />);
      const item = screen.getByRole('option');
      fireEvent.doubleClick(item);
      expect(mockOnFileDoubleClick).toHaveBeenCalledWith(sampleFile);
    });

    it('calls onFileRightClick on context menu', () => {
      render(<FileGridItem {...defaultProps} />);
      const item = screen.getByRole('option');
      fireEvent.contextMenu(item);
      expect(mockOnFileRightClick).toHaveBeenCalledWith(sampleFile, expect.any(Object));
    });
  });

  describe('View modes', () => {
    it('renders grid view styling in grid mode', () => {
      render(<FileGridItem {...defaultProps} isGridView={true} isListView={false} />);
      const item = screen.getByRole('option');
      expect(item.className).toContain('text-center');
    });

    it('renders list view styling in list mode', () => {
      render(
        <FileGridItem {...defaultProps} isGridView={false} isListView={true} viewMode="list" />,
      );
      const item = screen.getByRole('option');
      expect(item.className).toContain('flex');
    });

    it('renders content view with size and date in content mode', () => {
      render(
        <FileGridItem {...defaultProps} isGridView={false} isListView={false} viewMode="content" />,
      );
      // Content view renders size and date in multiple places
      const sizeElements = screen.getAllByText('2048 B');
      expect(sizeElements.length).toBeGreaterThanOrEqual(1);
      const dateElements = screen.getAllByText('Mar 2025');
      expect(dateElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Tags', () => {
    it('does not show tag dots when no tags', () => {
      render(<FileGridItem {...defaultProps} tags={[]} />);
      expect(screen.queryByTestId('tag-dots')).not.toBeInTheDocument();
    });

    it('shows tag dots in grid view when tags present', () => {
      const tags = [{ id: '1', name: 'important', color: '#ff0000', file_path: '' }];
      render(<FileGridItem {...defaultProps} tags={tags} isGridView={true} />);
      expect(screen.getByTestId('tag-dots')).toBeInTheDocument();
    });
  });

  describe('Git status', () => {
    it('shows git status dot when gitStatus is present', () => {
      render(<FileGridItem {...defaultProps} gitStatus="modified" />);
      expect(screen.getByTestId('git-status')).toBeInTheDocument();
    });

    it('does not show git status dot when gitStatus is null', () => {
      render(<FileGridItem {...defaultProps} gitStatus={null} />);
      expect(screen.queryByTestId('git-status')).not.toBeInTheDocument();
    });
  });

  describe('Rename mode', () => {
    it('shows rename input when isRenaming is true', () => {
      const mockOnRenameConfirm = vi.fn();
      const mockOnRenameCancel = vi.fn();
      const mockOnRenameTab = vi.fn();

      render(
        <FileGridItem
          {...defaultProps}
          isRenaming={true}
          existingNames={['other.txt']}
          onRenameConfirm={mockOnRenameConfirm}
          onRenameCancel={mockOnRenameCancel}
          onRenameTab={mockOnRenameTab}
        />,
      );

      expect(screen.getByLabelText('Rename file')).toBeInTheDocument();
    });

    it('does not trigger file click when renaming', () => {
      const mockOnRenameConfirm = vi.fn();
      const mockOnRenameCancel = vi.fn();
      const mockOnRenameTab = vi.fn();

      render(
        <FileGridItem
          {...defaultProps}
          isRenaming={true}
          existingNames={['other.txt']}
          onRenameConfirm={mockOnRenameConfirm}
          onRenameCancel={mockOnRenameCancel}
          onRenameTab={mockOnRenameTab}
        />,
      );

      const item = screen.getByRole('option');
      fireEvent.click(item);
      expect(mockOnFileClick).not.toHaveBeenCalled();
    });
  });

  describe('Chat files', () => {
    it('displays cleaned chat name for .chat files', () => {
      const chatFile: FileEntry = {
        name: '2026-03-14_my-chat-topic.chat',
        path: 'C:\\chats\\2026-03-14_my-chat-topic.chat',
        size: 500,
        is_dir: false,
        modified: Date.now(),
        file_type: 'chat',
      };
      render(<FileGridItem {...defaultProps} file={chatFile} />);
      expect(screen.getByText('my chat topic')).toBeInTheDocument();
    });

    it('shows Chat badge for .chat files', () => {
      const chatFile: FileEntry = {
        name: 'test.chat',
        path: 'C:\\chats\\test.chat',
        size: 500,
        is_dir: false,
        modified: Date.now(),
        file_type: 'chat',
      };
      render(<FileGridItem {...defaultProps} file={chatFile} />);
      expect(screen.getByText('Chat')).toBeInTheDocument();
    });
  });

  describe('Size badge', () => {
    it('shows size badge when showSizeBadge is true and info provided', () => {
      const { container } = render(
        <FileGridItem
          {...defaultProps}
          showSizeBadge={true}
          sizeBadgeInfo={{ percentile: 95, color: '#ff0000', label: 'Large' }}
        />,
      );
      // The size badge is a div with a specific style
      const badge = container.querySelector('[style*="border-radius: 50%"]');
      expect(badge).toBeInTheDocument();
    });

    it('does not show size badge when showSizeBadge is false', () => {
      const { container } = render(
        <FileGridItem
          {...defaultProps}
          showSizeBadge={false}
          sizeBadgeInfo={{ percentile: 95, color: '#ff0000', label: 'Large' }}
        />,
      );
      const badges = container.querySelectorAll('[style*="border-radius: 50%"]');
      expect(badges).toHaveLength(0);
    });
  });
});
