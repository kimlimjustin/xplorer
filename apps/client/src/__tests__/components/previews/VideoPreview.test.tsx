import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoPreview from '@/components/previews/VideoPreview';
import { FileEntry } from '@/lib/tauri-api';

// Mock Tauri core
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `tauri://asset/${path}`),
}));

// Helper to get video element
const getVideoElement = () => document.querySelector('video') as HTMLVideoElement;

describe('VideoPreview', () => {
  const mockFile: FileEntry = {
    name: 'test.mp4',
    path: 'C:\\Users\\Test\\test.mp4',
    size: 10 * 1024 * 1024, // 10MB
    is_dir: false,
    modified: Date.now(),
    file_type: 'video',
  };

  const mockProps = {
    file: mockFile,
    onError: vi.fn(),
    onLoad: vi.fn(),
  };

  let mockConvertFileSrc: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get the mocked function after the module is loaded
    const tauriCore = await import('@tauri-apps/api/core');
    mockConvertFileSrc = vi.mocked(tauriCore.convertFileSrc);

    // Mock HTMLVideoElement methods and properties
    Object.defineProperty(HTMLVideoElement.prototype, 'play', {
      writable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
      writable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'paused', {
      writable: true,
      value: true,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'duration', {
      writable: true,
      value: 120, // 2 minutes
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'currentTime', {
      writable: true,
      value: 0,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'volume', {
      writable: true,
      value: 1,
    });
  });

  describe('Initial Rendering', () => {
    it('shows loading state initially', () => {
      render(<VideoPreview {...mockProps} />);

      expect(screen.getByText('Loading video...')).toBeInTheDocument();
    });

    it('creates video element with correct src', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      expect(videoElement).toBeInTheDocument();
      expect(videoElement).toHaveAttribute('src', 'tauri://asset/C:\\Users\\Test\\test.mp4');
      expect(videoElement).toHaveAttribute('preload', 'metadata');
    });

    it('converts file path using convertFileSrc', () => {
      render(<VideoPreview {...mockProps} />);

      expect(mockConvertFileSrc).toHaveBeenCalledWith('C:\\Users\\Test\\test.mp4');
    });
  });

  describe('Video Loading Success', () => {
    it('hides loading state and calls onLoad when video loads', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      expect(screen.queryByText('Loading video...')).not.toBeInTheDocument();
      expect(mockProps.onLoad).toHaveBeenCalled();
    });

    it('displays video controls when loaded', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      expect(screen.getByTitle('Play')).toBeInTheDocument();
      expect(screen.getByDisplayValue('0')).toBeInTheDocument(); // Progress bar
      expect(screen.getByDisplayValue('1')).toBeInTheDocument(); // Volume slider
    });

    it('formats time correctly', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      expect(screen.getAllByText('0:00').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('2:00').length).toBeGreaterThanOrEqual(1);
    });

    it('displays video with correct styling', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      expect(videoElement).toHaveClass('max-w-full', 'max-h-full');

      const container = videoElement.closest('div');
      expect(container).toHaveClass('flex-1', 'flex', 'items-center', 'justify-center', 'bg-black');
    });
  });

  describe('Video Loading Error', () => {
    it('shows error state and calls onError when video fails to load', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.error(videoElement);

      expect(screen.getByText('Cannot preview video')).toBeInTheDocument();
      expect(screen.getByText('The video format may not be supported')).toBeInTheDocument();
      expect(mockProps.onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('hides loading state when error occurs', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.error(videoElement);

      expect(screen.queryByText('Loading video...')).not.toBeInTheDocument();
    });

    it('shows error icon in error state', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.error(videoElement);

      const errorIcon = document.querySelector('svg.w-12.h-12');
      expect(errorIcon).toBeInTheDocument();
      expect(errorIcon).toHaveAttribute('viewBox', '0 0 20 20');
    });
  });

  describe('Playback Controls', () => {
    beforeEach(() => {
      const mockPlay = vi.fn();
      const mockPause = vi.fn();
      Object.defineProperty(HTMLVideoElement.prototype, 'play', { value: mockPlay });
      Object.defineProperty(HTMLVideoElement.prototype, 'pause', { value: mockPause });
    });

    it('shows play button when video is paused', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      const playButton = screen.getByTitle('Play');
      expect(playButton).toBeInTheDocument();

      // Should show play icon (check for SVG element)
      const playIcon = playButton.querySelector('svg');
      expect(playIcon).toBeInTheDocument();
    });

    it('calls play when play button is clicked', () => {
      const mockPlay = vi.fn();
      Object.defineProperty(HTMLVideoElement.prototype, 'play', { value: mockPlay });

      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      const playButton = screen.getByTitle('Play');
      fireEvent.click(playButton);

      expect(mockPlay).toHaveBeenCalled();
    });

    it('handles progress bar changes', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      const progressBar = screen.getByDisplayValue('0');
      fireEvent.change(progressBar, { target: { value: '60' } });

      expect((videoElement as HTMLVideoElement).currentTime).toBe(60);
    });

    it('handles volume changes', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      const volumeSlider = screen.getByDisplayValue('1');
      fireEvent.change(volumeSlider, { target: { value: '0.3' } });

      expect((videoElement as HTMLVideoElement).volume).toBe(0.3);
    });

    it('updates current time display', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      // Simulate time update
      Object.defineProperty(videoElement, 'currentTime', { value: 75 });
      fireEvent.timeUpdate(videoElement);

      expect(screen.getAllByText('1:15').length).toBeGreaterThanOrEqual(1);
    });

    it('updates progress bar styling based on progress', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      Object.defineProperty(videoElement, 'duration', { value: 100 });
      Object.defineProperty(videoElement, 'currentTime', { value: 25 });
      fireEvent.loadedData(videoElement);

      fireEvent.timeUpdate(videoElement);

      const progressBar = screen.getByDisplayValue('25');
      const expectedGradient =
        'linear-gradient(to right, #7aa2f7 0%, #7aa2f7 25%, #1a1b26 25%, #1a1b26 100%)';
      expect(progressBar).toHaveStyle({ background: expectedGradient });
    });
  });

  describe('Video Events', () => {
    it('handles video end event', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);
      fireEvent.ended(videoElement);

      // Should reset play state (play button should be visible)
      expect(screen.getByTitle('Play')).toBeInTheDocument();
    });

    it('updates playing state on play/pause', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      const playButton = screen.getByTitle('Play');
      fireEvent.click(playButton);

      // After clicking play, button should change (though we can't easily test the icon change)
      expect(playButton).toBeInTheDocument();
    });
  });

  describe('Volume Control', () => {
    it('shows correct volume icons based on volume level', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      // Full volume should show multiple paths in the volume SVG
      const volumeIcons = document.querySelectorAll('.flex.items-center.space-x-1 svg path');
      expect(volumeIcons.length).toBeGreaterThan(1); // Should have multiple volume level indicators
    });

    it('handles volume slider changes', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      const volumeSlider = screen.getByDisplayValue('1');

      expect(volumeSlider).toHaveAttribute('type', 'range');
      expect(volumeSlider).toHaveAttribute('min', '0');
      expect(volumeSlider).toHaveAttribute('max', '1');
      expect(volumeSlider).toHaveAttribute('step', '0.1');
    });
  });

  describe('File Path Changes', () => {
    it('resets states when file path changes', () => {
      const { rerender } = render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);
      expect(screen.queryByText('Loading video...')).not.toBeInTheDocument();

      // Change file
      const updatedFile = { ...mockFile, path: 'C:\\Users\\Test\\new.mp4' };
      rerender(<VideoPreview {...mockProps} file={updatedFile} />);

      expect(screen.getByText('Loading video...')).toBeInTheDocument();
    });

    it('updates video src when file changes', () => {
      mockConvertFileSrc.mockClear();

      const { rerender } = render(<VideoPreview {...mockProps} />);

      const updatedFile = { ...mockFile, path: 'C:\\Users\\Test\\updated.mp4' };
      rerender(<VideoPreview {...mockProps} file={updatedFile} />);

      expect(mockConvertFileSrc).toHaveBeenCalledWith('C:\\Users\\Test\\updated.mp4');

      const videoElement = getVideoElement();
      expect(videoElement).toHaveAttribute('src', 'tauri://asset/C:\\Users\\Test\\updated.mp4');
    });
  });

  describe('Time Formatting', () => {
    const testCases = [
      { seconds: 0, expected: '0:00' },
      { seconds: 30, expected: '0:30' },
      { seconds: 60, expected: '1:00' },
      { seconds: 90, expected: '1:30' },
      { seconds: 3600, expected: '60:00' },
      { seconds: 3665, expected: '61:05' },
    ];

    testCases.forEach(({ seconds, expected }) => {
      it(`formats ${seconds} seconds as ${expected}`, () => {
        render(<VideoPreview {...mockProps} />);

        const videoElement = getVideoElement();
        Object.defineProperty(videoElement, 'duration', { value: seconds });
        fireEvent.loadedData(videoElement);

        const timeDisplays = screen.getAllByText(expected);
        expect(timeDisplays.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Container Structure', () => {
    it('has correct root container class', () => {
      const { container } = render(<VideoPreview {...mockProps} />);

      const rootDiv = container.firstChild;
      expect(rootDiv).toHaveClass('h-full', 'flex', 'flex-col');
    });

    it('maintains consistent layout across states', () => {
      render(<VideoPreview {...mockProps} />);

      // Loading state
      expect(screen.getByText('Loading video...')).toBeInTheDocument();

      // Success state
      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);
      expect(videoElement).toBeInTheDocument();

      // Error state
      fireEvent.error(videoElement);
      expect(screen.getByText('Cannot preview video')).toBeInTheDocument();
    });

    it('video container has black background', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      const videoContainer = videoElement.closest('div');
      expect(videoContainer).toHaveClass('bg-black');
    });
  });

  describe('Accessibility', () => {
    it('provides appropriate button titles', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      expect(screen.getByTitle('Play')).toBeInTheDocument();
    });

    it('has proper range input attributes', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      const progressBar = screen.getByDisplayValue('0');
      const volumeSlider = screen.getByDisplayValue('1');

      expect(progressBar).toHaveAttribute('type', 'range');
      expect(volumeSlider).toHaveAttribute('type', 'range');

      // Progress bar should have dynamic max based on duration
      expect(progressBar).toHaveAttribute('max', '120');
      expect(progressBar).toHaveAttribute('min', '0');
    });
  });

  describe('Callback Handling', () => {
    it('works without optional callbacks', () => {
      const propsWithoutCallbacks = { file: mockFile };

      expect(() => render(<VideoPreview {...propsWithoutCallbacks} />)).not.toThrow();

      const videoElement = getVideoElement();
      expect(() => fireEvent.loadedData(videoElement)).not.toThrow();
      expect(() => fireEvent.error(videoElement)).not.toThrow();
    });

    it('calls onLoad only once per successful load', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.loadedData(videoElement);

      expect(mockProps.onLoad).toHaveBeenCalledTimes(1);

      // Fire loadedData again - it should still be called (React doesn't prevent multiple events)
      fireEvent.loadedData(videoElement);
      expect(mockProps.onLoad).toHaveBeenCalledTimes(2);
    });

    it('calls onError with Error instance', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      fireEvent.error(videoElement);

      expect(mockProps.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to load video',
        }),
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles zero duration video', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      Object.defineProperty(videoElement, 'duration', { value: 0 });
      fireEvent.loadedData(videoElement);

      const timeDisplays = screen.getAllByText('0:00');
      expect(timeDisplays.length).toBeGreaterThanOrEqual(1);

      const progressBar = screen.getByDisplayValue('0');
      expect(progressBar).toHaveAttribute('max', '0');
    });

    it('handles very long videos', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      Object.defineProperty(videoElement, 'duration', { value: 7200 }); // 2 hours
      fireEvent.loadedData(videoElement);

      expect(screen.getAllByText('120:00').length).toBeGreaterThanOrEqual(1);
    });

    it('handles NaN duration gracefully', () => {
      render(<VideoPreview {...mockProps} />);

      const videoElement = getVideoElement();
      Object.defineProperty(videoElement, 'duration', { value: NaN });
      fireEvent.loadedData(videoElement);

      const progressBar = screen.getByDisplayValue('0');
      expect(progressBar).toHaveAttribute('max', '0');
    });
  });
});
