import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Music, Headphones, Volume2, Mic } from 'lucide-react';
import { PreviewProps } from '@/lib/preview-factory';
import { convertAssetUrl } from '@/lib/transport';
import { formatFileSize } from '@/lib/utils';
import { formatTime } from '@/lib/format-utils';

const getAudioIcon = (fileName: string): React.ReactNode => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const size = 28;
  const cls = 'inline-block text-xp-text-muted';
  switch (ext) {
    case 'mp3':
      return <Music size={size} className={cls} />;
    case 'wav':
      return <Music size={size} className={cls} />;
    case 'flac':
      return <Music size={size} className={cls} />;
    case 'ogg':
      return <Headphones size={size} className={cls} />;
    case 'aac':
      return <Volume2 size={size} className={cls} />;
    case 'm4a':
      return <Mic size={size} className={cls} />;
    default:
      return <Mic size={size} className={cls} />;
  }
};

const getFormatLabel = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toUpperCase() || 'AUDIO';
  return ext;
};

const AudioPreview = ({ file, onError, onLoad }: PreviewProps) => {
  const [audioError, setAudioError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audioSrc, setAudioSrc] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    // Reset states when file changes
    setLoading(true);
    setAudioError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    // Convert file path to Tauri asset URL
    const assetUrl = convertAssetUrl(file.path);
    setAudioSrc(assetUrl);

    // Cleanup previous audio context
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [file.path]);

  const initAudioVisualization = useCallback(() => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;

    // Only initialize once per audio element
    if (sourceRef.current) return;

    try {
      const audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      const source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch {
      // AudioContext failed - visualization will not be shown
      console.warn('AudioContext not available, visualization disabled');
    }
  }, []);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      // Get xp-primary color from CSS variable
      const primaryColor =
        getComputedStyle(document.documentElement).getPropertyValue('--xp-primary').trim() ||
        '#7aa2f7';

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        ctx.fillStyle = primaryColor;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
  }, []);

  const handleLoadedData = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      const dur = isNaN(audio.duration) ? 0 : audio.duration;
      setDuration(dur);
      setCurrentTime(audio.currentTime);
    }
    setLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setAudioError(true);
    setLoading(false);
    onError?.(new Error('Failed to load audio'));
  }, [onError]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      // Initialize visualization on first play
      initAudioVisualization();
      audio.play();
      setIsPlaying(true);
      drawWaveform();
    } else {
      audio.pause();
      setIsPlaying(false);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    }
  }, [initAudioVisualization, drawWaveform]);

  const handleProgressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (audio) {
      const time = parseFloat(e.target.value);
      audio.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (audio) {
      const vol = parseFloat(e.target.value);
      audio.volume = vol;
      setVolume(vol);
    }
  }, []);

  const safeDuration = isNaN(duration) ? 0 : duration;
  const progressPercent = safeDuration > 0 ? (currentTime / safeDuration) * 100 : 0;

  if (audioError) {
    return (
      <div className="flex h-full flex-col">
        <div className="bg-xp-surface border-xp-border flex flex-1 items-center justify-center rounded border">
          <div className="text-xp-text-muted text-center">
            <svg className="mx-auto mb-2 h-12 w-12" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm">Cannot preview audio</p>
            <p className="mt-1 text-xs opacity-70">The audio format may not be supported</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="metadata"
        style={{ display: 'none' }}
        onLoadedData={handleLoadedData}
        onError={handleError}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        crossOrigin="anonymous"
      />

      {loading && (
        <div className="bg-xp-surface border-xp-border flex flex-1 items-center justify-center rounded border">
          <div className="text-xp-text-muted text-center">
            <div className="animate-pulse">
              <div className="bg-xp-bg mx-auto mb-2 h-16 w-16 rounded" />
              <p className="text-xs">Loading audio...</p>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="flex flex-1 flex-col">
          {/* File Info */}
          <div className="bg-xp-surface flex flex-col items-center px-4 py-6">
            <div className="mb-3 text-3xl">{getAudioIcon(file.name)}</div>
            <h3 className="text-xp-text max-w-full truncate text-sm font-medium">{file.name}</h3>
            <div className="text-xp-text-muted mt-1 flex items-center space-x-3 text-xs">
              <span>{getFormatLabel(file.name)}</span>
              <span>{formatFileSize(file.size)}</span>
            </div>
          </div>

          {/* Waveform Visualization */}
          <div className="bg-xp-surface px-4 py-3">
            <canvas ref={canvasRef} width={280} height={60} className="bg-xp-bg w-full rounded" />
          </div>

          {/* Progress bar */}
          <div className="bg-xp-surface px-4 py-2">
            <div className="text-xp-text flex items-center space-x-2 text-xs">
              <span>{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={String(safeDuration)}
                step="0.1"
                value={currentTime}
                onChange={handleProgressChange}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full"
                style={{
                  background: `linear-gradient(to right, #7aa2f7 0%, #7aa2f7 ${progressPercent}%, #1a1b26 ${progressPercent}%, #1a1b26 100%)`,
                }}
              />
              <span>{formatTime(safeDuration)}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="bg-xp-surface border-xp-border border-t px-4 py-3">
            <div className="flex items-center justify-center space-x-4">
              {/* Previous track */}
              <button
                title="Previous track"
                disabled
                className="text-xp-text cursor-not-allowed rounded p-1.5 opacity-50"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
                </svg>
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                title={isPlaying ? 'Pause' : 'Play'}
                className="hover:bg-xp-surface-light text-xp-text bg-xp-primary/20 rounded-full p-2"
              >
                {isPlaying ? (
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>

              {/* Next track */}
              <button
                title="Next track"
                disabled
                className="text-xp-text cursor-not-allowed rounded p-1.5 opacity-50"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11.555 5.168A1 1 0 0010 6v2.798L4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4z" />
                </svg>
              </button>
            </div>

            {/* Volume */}
            <div className="mt-3 flex items-center justify-center space-x-2">
              <svg className="text-xp-text h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="h-1 w-24 cursor-pointer appearance-none rounded-full"
                style={{
                  background: `linear-gradient(to right, #7aa2f7 0%, #7aa2f7 ${volume * 100}%, #1a1b26 ${volume * 100}%, #1a1b26 100%)`,
                }}
              />
              <span className="text-xp-text-muted w-8 text-xs">{Math.round(volume * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(AudioPreview);
