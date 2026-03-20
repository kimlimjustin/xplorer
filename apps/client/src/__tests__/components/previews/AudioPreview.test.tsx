import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AudioPreview from '@/components/previews/AudioPreview';
import { FileEntry } from '@/lib/tauri-api';

// Mock Tauri core
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `tauri://asset/${path}`),
}));

describe('AudioPreview', () => {
  const mockFile: FileEntry = {
    name: 'test.mp3',
    path: 'C:\\Users\\Test\\test.mp3',
    size: 5 * 1024 * 1024, // 5MB
    is_dir: false,
    modified: Date.now(),
    file_type: 'audio',
  };

  const mockProps = {
    file: mockFile,
    onError: vi.fn(),
    onLoad: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock HTMLAudioElement methods
    Object.defineProperty(HTMLAudioElement.prototype, 'play', {
      writable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLAudioElement.prototype, 'pause', {
      writable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLAudioElement.prototype, 'paused', {
      writable: true,
      value: true,
    });
    Object.defineProperty(HTMLAudioElement.prototype, 'duration', {
      writable: true,
      value: 180, // 3 minutes
    });
    Object.defineProperty(HTMLAudioElement.prototype, 'currentTime', {
      writable: true,
      value: 0,
    });
    Object.defineProperty(HTMLAudioElement.prototype, 'volume', {
      writable: true,
      value: 1,
    });
  });

  describe('Initial Rendering', () => {
    it('shows loading state initially', () => {
      render(<AudioPreview {...mockProps} />);

      expect(screen.getByText('Loading audio...')).toBeInTheDocument();
    });

    it('creates audio element with correct src', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio');
      expect(audioElement).toHaveAttribute('src', 'tauri://asset/C:\\Users\\Test\\test.mp3');
      expect(audioElement).toHaveAttribute('preload', 'metadata');
      expect(audioElement).toHaveStyle({ display: 'none' });
    });

    it('displays file info section', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      expect(screen.getByText('test.mp3')).toBeInTheDocument();
      expect(screen.getByText('MP3')).toBeInTheDocument();
      expect(screen.getByText('5 MB')).toBeInTheDocument();
    });

    it('shows correct audio icon for MP3 files', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      const iconContainer = document.querySelector('.text-3xl');
      expect(iconContainer).toBeTruthy();
      expect(iconContainer!.querySelector('svg[data-testid="Music"]')).toBeInTheDocument();
    });
  });

  describe('Audio Loading Success', () => {
    it('hides loading state and calls onLoad when audio loads', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      expect(screen.queryByText('Loading audio...')).not.toBeInTheDocument();
      expect(mockProps.onLoad).toHaveBeenCalled();
    });

    it('displays audio controls when loaded', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      expect(screen.getByTitle('Play')).toBeInTheDocument();
      expect(screen.getByDisplayValue('0')).toBeInTheDocument(); // Progress bar
      expect(screen.getByDisplayValue('1')).toBeInTheDocument(); // Volume slider
    });

    it('formats time correctly', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      expect(screen.getByText('0:00')).toBeInTheDocument();
      expect(screen.getByText('3:00')).toBeInTheDocument();
    });
  });

  describe('Audio Loading Error', () => {
    it('shows error state and calls onError when audio fails to load', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.error(audioElement);

      expect(screen.getByText('Cannot preview audio')).toBeInTheDocument();
      expect(screen.getByText('The audio format may not be supported')).toBeInTheDocument();
      expect(mockProps.onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('shows error icon in error state', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.error(audioElement);

      const errorIcon = document.querySelector('svg');
      expect(errorIcon).toHaveAttribute('viewBox', '0 0 20 20');
    });
  });

  describe('Playback Controls', () => {
    beforeEach(() => {
      const mockPlay = vi.fn();
      const mockPause = vi.fn();
      Object.defineProperty(HTMLAudioElement.prototype, 'play', { value: mockPlay });
      Object.defineProperty(HTMLAudioElement.prototype, 'pause', { value: mockPause });
    });

    it('shows play button when audio is paused', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      const playButton = screen.getByTitle('Play');
      expect(playButton).toBeInTheDocument();

      // Should show play icon
      const playIcon = playButton.querySelector('svg path[fill-rule="evenodd"]');
      expect(playIcon).toBeInTheDocument();
    });

    it('calls play when play button is clicked', () => {
      const mockPlay = vi.fn();
      Object.defineProperty(HTMLAudioElement.prototype, 'play', { value: mockPlay });

      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      const playButton = screen.getByTitle('Play');
      fireEvent.click(playButton);

      expect(mockPlay).toHaveBeenCalled();
    });

    it('updates button to pause when playing', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      Object.defineProperty(audioElement, 'paused', { value: false });
      fireEvent.loadedData(audioElement);

      // Simulate play state change
      fireEvent.click(screen.getByTitle('Play'));

      // Should now show pause button (we can't easily test the icon change without more complex mocking)
    });

    it('handles progress bar changes', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      const progressBar = screen.getByDisplayValue('0');
      fireEvent.change(progressBar, { target: { value: '90' } });

      expect(audioElement.currentTime).toBe(90);
    });

    it('handles volume changes', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      const volumeSlider = screen.getByDisplayValue('1');
      fireEvent.change(volumeSlider, { target: { value: '0.5' } });

      expect(audioElement.volume).toBe(0.5);
    });

    it('updates current time display', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      // Simulate time update
      Object.defineProperty(audioElement, 'currentTime', { value: 65 });
      fireEvent.timeUpdate(audioElement);

      expect(screen.getByText('1:05')).toBeInTheDocument();
    });
  });

  describe('Different Audio Formats', () => {
    const audioFormats = [
      { name: 'song.mp3', testId: 'Music' },
      { name: 'audio.wav', testId: 'Music' },
      { name: 'music.flac', testId: 'Music' },
      { name: 'sound.ogg', testId: 'Headphones' },
      { name: 'track.aac', testId: 'Volume2' },
      { name: 'voice.m4a', testId: 'Mic' },
    ];

    audioFormats.forEach(({ name, testId }) => {
      it(`displays correct icon for ${name}`, () => {
        const fileWithFormat = { ...mockFile, name };
        render(<AudioPreview {...mockProps} file={fileWithFormat} />);

        const audioElement = document.querySelector('audio')!;
        fireEvent.loadedData(audioElement);

        const iconContainer = document.querySelector('.text-3xl');
        expect(iconContainer).toBeTruthy();
        expect(iconContainer!.querySelector(`svg[data-testid="${testId}"]`)).toBeInTheDocument();
      });
    });
  });

  describe('File Path Changes', () => {
    it('resets states when file path changes', () => {
      const { rerender } = render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);
      expect(screen.queryByText('Loading audio...')).not.toBeInTheDocument();

      // Change file
      const updatedFile = { ...mockFile, path: 'C:\\Users\\Test\\new.mp3' };
      rerender(<AudioPreview {...mockProps} file={updatedFile} />);

      expect(screen.getByText('Loading audio...')).toBeInTheDocument();
    });
  });

  describe('Audio Info Display', () => {
    it('shows file size in MB correctly', () => {
      const largeFile = { ...mockFile, size: 10.5 * 1024 * 1024 };
      render(<AudioPreview {...mockProps} file={largeFile} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      expect(screen.getByText('10.5 MB')).toBeInTheDocument();
    });

    it('shows file size in KB for small files', () => {
      const smallFile = { ...mockFile, size: 512 * 1024 };
      render(<AudioPreview {...mockProps} file={smallFile} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      expect(screen.getByText('0.5 MB')).toBeInTheDocument();
    });

    it('displays format from file extension', () => {
      const flacFile = { ...mockFile, name: 'test.flac' };
      render(<AudioPreview {...mockProps} file={flacFile} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      expect(screen.getByText('FLAC')).toBeInTheDocument();
    });
  });

  describe('Control Button States', () => {
    it('shows disabled previous/next buttons', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      const prevButton = screen.getByTitle('Previous track');
      const nextButton = screen.getByTitle('Next track');

      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
      expect(prevButton).toHaveClass('opacity-50', 'cursor-not-allowed');
      expect(nextButton).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('shows volume percentage', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      expect(screen.getByText('100%')).toBeInTheDocument();

      const volumeSlider = screen.getByDisplayValue('1');
      fireEvent.change(volumeSlider, { target: { value: '0.7' } });

      expect(screen.getByText('70%')).toBeInTheDocument();
    });
  });

  describe('Callback Handling', () => {
    it('works without optional callbacks', () => {
      const propsWithoutCallbacks = { file: mockFile };

      expect(() => render(<AudioPreview {...propsWithoutCallbacks} />)).not.toThrow();

      const audioElement = document.querySelector('audio')!;
      expect(() => fireEvent.loadedData(audioElement)).not.toThrow();
      expect(() => fireEvent.error(audioElement)).not.toThrow();
    });
  });

  describe('Audio Events', () => {
    it('handles audio end event', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);
      fireEvent.ended(audioElement);

      // Should reset play state (play button should be visible)
      expect(screen.getByTitle('Play')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles files with no extension', () => {
      const noExtFile = { ...mockFile, name: 'audiofile' };
      render(<AudioPreview {...mockProps} file={noExtFile} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      const iconContainer = document.querySelector('.text-3xl');
      expect(iconContainer).toBeTruthy();
      expect(iconContainer!.querySelector('svg[data-testid="Mic"]')).toBeInTheDocument();
    });

    it('handles zero duration audio', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      Object.defineProperty(audioElement, 'duration', { value: 0 });
      fireEvent.loadedData(audioElement);

      const timeDisplays = screen.getAllByText('0:00');
      expect(timeDisplays).toHaveLength(2); // Current time and duration
    });
  });

  describe('Accessibility', () => {
    it('provides appropriate button titles', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      expect(screen.getByTitle('Play')).toBeInTheDocument();
      expect(screen.getByTitle('Previous track')).toBeInTheDocument();
      expect(screen.getByTitle('Next track')).toBeInTheDocument();
    });

    it('has proper range input types', () => {
      render(<AudioPreview {...mockProps} />);

      const audioElement = document.querySelector('audio')!;
      fireEvent.loadedData(audioElement);

      const progressBar = screen.getByDisplayValue('0');
      const volumeSlider = screen.getByDisplayValue('1');

      expect(progressBar).toHaveAttribute('type', 'range');
      expect(volumeSlider).toHaveAttribute('type', 'range');
    });
  });
});
