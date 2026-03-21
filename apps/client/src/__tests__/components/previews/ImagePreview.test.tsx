import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImagePreview from '@/components/previews/ImagePreview';
import { FileEntry } from '@/lib/tauri-api';

// Mock transport layer (ImagePreview uses convertAssetUrl, not convertFileSrc directly)
const mockConvertAssetUrl = vi.fn(
  (path: string) => `https://asset.localhost/${encodeURIComponent(path)}`,
);
vi.mock('@/lib/transport', () => ({
  convertAssetUrl: (...args: unknown[]) => mockConvertAssetUrl(...args),
}));

describe('ImagePreview', () => {
  const mockFile: FileEntry = {
    name: 'test.jpg',
    path: 'C:\\Users\\Test\\test.jpg',
    size: 1024 * 1024,
    is_dir: false,
    modified: Date.now(),
    file_type: 'image',
  };

  const mockProps = {
    file: mockFile,
    onError: vi.fn(),
    onLoad: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('shows loading state initially', () => {
      render(<ImagePreview {...mockProps} />);

      expect(screen.getByRole('status', { name: 'Loading preview' })).toBeInTheDocument();
    });

    it('creates image element with correct src', () => {
      render(<ImagePreview {...mockProps} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute(
        'src',
        `https://asset.localhost/${encodeURIComponent('C:\\Users\\Test\\test.jpg')}`,
      );
      expect(image).toHaveAttribute('alt', 'test.jpg');
    });

    it('converts file path using convertAssetUrl', () => {
      render(<ImagePreview {...mockProps} />);

      expect(mockConvertAssetUrl).toHaveBeenCalledWith('C:\\Users\\Test\\test.jpg');
    });
  });

  describe('Image Loading Success', () => {
    it('hides loading state and calls onLoad when image loads', () => {
      render(<ImagePreview {...mockProps} />);

      const image = screen.getByRole('img');
      fireEvent.load(image);

      expect(screen.queryByRole('status', { name: 'Loading preview' })).not.toBeInTheDocument();
      expect(mockProps.onLoad).toHaveBeenCalled();
    });

    it('displays image with correct styling classes', () => {
      render(<ImagePreview {...mockProps} />);

      const image = screen.getByRole('img');
      fireEvent.load(image);

      expect(image).toHaveClass('max-w-full', 'max-h-full', 'object-contain');
    });

    it('applies correct container classes for successful load', () => {
      render(<ImagePreview {...mockProps} />);

      const image = screen.getByRole('img');
      fireEvent.load(image);

      const container = image.closest('div');
      expect(container).toHaveClass(
        'flex-1',
        'flex',
        'items-center',
        'justify-center',
        'bg-xp-surface',
        'border',
        'border-xp-border',
        'rounded',
        'overflow-hidden',
      );
    });
  });

  describe('Image Loading Error', () => {
    it('shows error state and calls onError when image fails to load', () => {
      render(<ImagePreview {...mockProps} />);

      const image = screen.getByRole('img');
      fireEvent.error(image);

      expect(screen.getByText('Cannot preview image')).toBeInTheDocument();
      expect(screen.getByText('The image format may not be supported')).toBeInTheDocument();
      expect(mockProps.onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('hides loading state when error occurs', () => {
      render(<ImagePreview {...mockProps} />);

      const image = screen.getByRole('img');
      fireEvent.error(image);

      expect(screen.queryByRole('status', { name: 'Loading preview' })).not.toBeInTheDocument();
    });

    it('shows error icon in error state', () => {
      render(<ImagePreview {...mockProps} />);

      const image = screen.getByRole('img');
      fireEvent.error(image);

      const errorIcon = document.querySelector('svg.w-12.h-12');
      expect(errorIcon).toBeInTheDocument();
      expect(errorIcon).toHaveAttribute('viewBox', '0 0 20 20');
      expect(errorIcon).toHaveClass('w-12', 'h-12', 'mx-auto', 'mb-2');
    });

    it('applies correct container classes for error state', () => {
      render(<ImagePreview {...mockProps} />);

      const image = screen.getByRole('img');
      fireEvent.error(image);

      const errorContainer = screen.getByText('Cannot preview image').parentElement?.parentElement;
      expect(errorContainer).toHaveClass(
        'flex-1',
        'flex',
        'items-center',
        'justify-center',
        'bg-xp-surface',
        'border',
        'border-xp-border',
        'rounded',
      );
    });
  });

  describe('File Path Changes', () => {
    it('resets states and updates image src when file path changes', () => {
      const { rerender } = render(<ImagePreview {...mockProps} />);

      // Simulate successful load
      const image = screen.getByRole('img');
      fireEvent.load(image);

      expect(screen.queryByRole('status', { name: 'Loading preview' })).not.toBeInTheDocument();

      // Change file path
      const updatedFile = { ...mockFile, path: 'C:\\Users\\Test\\updated.png' };
      rerender(<ImagePreview {...mockProps} file={updatedFile} />);

      // Should show loading state again
      expect(screen.getByRole('status', { name: 'Loading preview' })).toBeInTheDocument();
      expect(mockConvertAssetUrl).toHaveBeenCalledWith('C:\\Users\\Test\\updated.png');
    });

    it('resets error state when file changes', () => {
      const { rerender } = render(<ImagePreview {...mockProps} />);

      // Simulate error
      const image = screen.getByRole('img');
      fireEvent.error(image);

      expect(screen.getByText('Cannot preview image')).toBeInTheDocument();

      // Change file
      const updatedFile = { ...mockFile, path: 'C:\\Users\\Test\\new.jpg' };
      rerender(<ImagePreview {...mockProps} file={updatedFile} />);

      // Should reset to loading state
      expect(screen.getByRole('status', { name: 'Loading preview' })).toBeInTheDocument();
      expect(screen.queryByText('Cannot preview image')).not.toBeInTheDocument();
    });
  });

  describe('Container Structure', () => {
    it('has correct root container class', () => {
      const { container } = render(<ImagePreview {...mockProps} />);

      const rootDiv = container.firstChild;
      expect(rootDiv).toHaveClass('h-full', 'flex', 'flex-col');
    });

    it('maintains consistent layout structure across states', () => {
      const { rerender } = render(<ImagePreview {...mockProps} />);

      // Loading state
      expect(screen.getByRole('status', { name: 'Loading preview' })).toBeInTheDocument();

      // Success state
      const image = screen.getByRole('img');
      fireEvent.load(image);
      expect(image).toBeInTheDocument();

      // Error state
      rerender(<ImagePreview {...mockProps} />);
      const newImage = screen.getByRole('img');
      fireEvent.error(newImage);
      expect(screen.getByText('Cannot preview image')).toBeInTheDocument();

      // All states should maintain the same container structure
      const containers = document.querySelectorAll('.flex-1');
      expect(containers).toHaveLength(1);
    });
  });

  describe('Accessibility', () => {
    it('provides correct alt text for image', () => {
      render(<ImagePreview {...mockProps} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', mockFile.name);
    });

    it('provides descriptive text in error state', () => {
      render(<ImagePreview {...mockProps} />);

      const image = screen.getByRole('img');
      fireEvent.error(image);

      expect(screen.getByText('Cannot preview image')).toBeInTheDocument();
      expect(screen.getByText('The image format may not be supported')).toBeInTheDocument();
    });

    it('provides descriptive text in loading state', () => {
      render(<ImagePreview {...mockProps} />);

      const skeleton = screen.getByRole('status', { name: 'Loading preview' });
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Callback Handling', () => {
    it('works without optional callbacks', () => {
      const propsWithoutCallbacks = { file: mockFile };

      expect(() => render(<ImagePreview {...propsWithoutCallbacks} />)).not.toThrow();

      const image = screen.getByRole('img');
      expect(() => fireEvent.load(image)).not.toThrow();
      expect(() => fireEvent.error(image)).not.toThrow();
    });

    it('calls onLoad only once per successful load', () => {
      render(<ImagePreview {...mockProps} />);

      const image = screen.getByRole('img');
      fireEvent.load(image);

      expect(mockProps.onLoad).toHaveBeenCalledTimes(1);

      // Fire load again - it should still be called (React doesn't prevent multiple load events)
      fireEvent.load(image);
      expect(mockProps.onLoad).toHaveBeenCalledTimes(2);
    });

    it('calls onError with Error instance', () => {
      render(<ImagePreview {...mockProps} />);

      const image = screen.getByRole('img');
      fireEvent.error(image);

      expect(mockProps.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to load image',
        }),
      );
    });
  });

  describe('Different Image Types', () => {
    const imageTypes = [
      { name: 'photo.jpg', type: 'jpeg' },
      { name: 'logo.png', type: 'png' },
      { name: 'animation.gif', type: 'gif' },
      { name: 'vector.svg', type: 'svg' },
      { name: 'icon.ico', type: 'icon' },
    ];

    imageTypes.forEach(({ name, type }) => {
      it(`handles ${type} files correctly`, () => {
        const fileWithType = { ...mockFile, name };
        render(<ImagePreview {...mockProps} file={fileWithType} />);

        const image = screen.getByRole('img');
        expect(image).toHaveAttribute('alt', name);
      });
    });
  });

  describe('Loading Animation', () => {
    it('displays animated loading placeholder', () => {
      render(<ImagePreview {...mockProps} />);

      // PreviewSkeleton renders with role="status" and uses inline shimmer animation
      const skeleton = screen.getByRole('status', { name: 'Loading preview' });
      expect(skeleton).toBeInTheDocument();

      // Skeleton contains shimmer blocks with aria-hidden="true"
      const shimmerBlocks = skeleton.querySelectorAll('[aria-hidden="true"]');
      expect(shimmerBlocks.length).toBeGreaterThan(0);
    });

    it('removes loading animation when image loads', () => {
      render(<ImagePreview {...mockProps} />);

      const image = screen.getByRole('img');
      fireEvent.load(image);

      expect(screen.queryByRole('status', { name: 'Loading preview' })).not.toBeInTheDocument();
    });

    it('removes loading animation when error occurs', () => {
      render(<ImagePreview {...mockProps} />);

      const image = screen.getByRole('img');
      fireEvent.error(image);

      expect(screen.queryByRole('status', { name: 'Loading preview' })).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles files with special characters in names', () => {
      const specialFile = {
        ...mockFile,
        name: 'image with spaces & symbols!.jpg',
        path: 'C:\\Users\\Test\\image with spaces & symbols!.jpg',
      };

      render(<ImagePreview {...mockProps} file={specialFile} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', 'image with spaces & symbols!.jpg');
    });

    it('handles very long file names', () => {
      const longFileName = `${'a'.repeat(200)}.jpg`;
      const longNameFile = { ...mockFile, name: longFileName };

      render(<ImagePreview {...mockProps} file={longNameFile} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', longFileName);
    });

    it('handles files with no extension', () => {
      const noExtFile = { ...mockFile, name: 'imagefile' };

      render(<ImagePreview {...mockProps} file={noExtFile} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', 'imagefile');
    });
  });
});
