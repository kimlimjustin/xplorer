import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Music, Headphones, Volume2, Mic } from 'lucide-react';
import { PreviewProps } from '@/lib/preview-factory';
import { convertAssetUrl } from '@/lib/transport';

const formatTime = (seconds: number) : string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const formatSize = (bytes: number) : string => {
  const mb = bytes / (1024 * 1024);
  return `${Number(mb.toFixed(1))} MB`;
}

const getAudioIcon = (fileName: string) : React.ReactNode => {
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
}

const getFormatLabel = (fileName: string) : string => {
  const ext = fileName.split('.').pop()?.toUpperCase() || 'AUDIO';
  return ext;
}

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
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center bg-xp-surface border border-xp-border rounded">
          <div className="text-center text-xp-text-muted">
            <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm">Cannot preview audio</p>
            <p className="text-xs mt-1 opacity-70">The audio format may not be supported</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
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
        <div className="flex-1 flex items-center justify-center bg-xp-surface border border-xp-border rounded">
          <div className="text-center text-xp-text-muted">
            <div className="animate-pulse">
              <div className="w-16 h-16 bg-xp-bg rounded mb-2 mx-auto"></div>
              <p className="text-xs">Loading audio...</p>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="flex-1 flex flex-col">
          {/* File Info */}
          <div className="flex flex-col items-center py-6 px-4 bg-xp-surface">
            <div className="text-3xl mb-3">{getAudioIcon(file.name)}</div>
            <h3 className="text-sm font-medium text-xp-text truncate max-w-full">{file.name}</h3>
            <div className="flex items-center space-x-3 mt-1 text-xs text-xp-text-muted">
              <span>{getFormatLabel(file.name)}</span>
              <span>{formatSize(file.size)}</span>
            </div>
          </div>

          {/* Waveform Visualization */}
          <div className="px-4 py-3 bg-xp-surface">
            <canvas ref={canvasRef} width={280} height={60} className="w-full rounded bg-xp-bg" />
          </div>

          {/* Progress bar */}
          <div className="px-4 py-2 bg-xp-surface">
            <div className="flex items-center space-x-2 text-xs text-xp-text">
              <span>{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={String(safeDuration)}
                step="0.1"
                value={currentTime}
                onChange={handleProgressChange}
                className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #7aa2f7 0%, #7aa2f7 ${progressPercent}%, #1a1b26 ${progressPercent}%, #1a1b26 100%)`,
                }}
              />
              <span>{formatTime(safeDuration)}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="px-4 py-3 bg-xp-surface border-t border-xp-border">
            <div className="flex items-center justify-center space-x-4">
              {/* Previous track */}
              <button
                title="Previous track"
                disabled
                className="p-1.5 rounded text-xp-text opacity-50 cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
                </svg>
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                title={isPlaying ? 'Pause' : 'Play'}
                className="p-2 rounded-full hover:bg-xp-surface-light text-xp-text bg-xp-primary/20"
              >
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
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
                className="p-1.5 rounded text-xp-text opacity-50 cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11.555 5.168A1 1 0 0010 6v2.798L4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4z" />
                </svg>
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center justify-center space-x-2 mt-3">
              <svg className="w-4 h-4 text-xp-text" fill="currentColor" viewBox="0 0 20 20">
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
                className="w-24 h-1 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #7aa2f7 0%, #7aa2f7 ${volume * 100}%, #1a1b26 ${volume * 100}%, #1a1b26 100%)`,
                }}
              />
              <span className="text-xs text-xp-text-muted w-8">{Math.round(volume * 100)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(AudioPreview);
