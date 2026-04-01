import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Preview, type XplorerAPI } from '@xplorer/extension-sdk';

// ── Types ───────────────────────────────────────────────────────────────────

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified?: number;
  extension?: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma',
]);

const FORMAT_LABELS: Record<string, string> = {
  mp3: 'MP3', wav: 'WAV', ogg: 'OGG Vorbis', flac: 'FLAC',
  aac: 'AAC', m4a: 'MPEG-4 Audio', wma: 'Windows Media Audio',
};

const BAR_WIDTH = 3;
const BAR_GAP = 1;
const CANVAS_HEIGHT = 100;

// ── Helpers ─────────────────────────────────────────────────────────────────

function getExtension(path: string): string {
  return path.split('.').pop()?.toLowerCase() || '';
}

function isAudioFile(path: string): boolean {
  return AUDIO_EXTENSIONS.has(getExtension(path));
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSampleRate(rate: number): string {
  if (rate >= 1000) return `${(rate / 1000).toFixed(1)} kHz`;
  return `${rate} Hz`;
}

// ── SVG Icons ───────────────────────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
    </svg>
  );
}

function VolumeHighIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function VolumeLowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function VolumeMuteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function MusicNoteIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" fill="currentColor" />
      <circle cx="18" cy="16" r="3" fill="currentColor" />
    </svg>
  );
}

// ── Waveform Extraction ─────────────────────────────────────────────────────

function extractPeaks(audioBuffer: AudioBuffer, barCount: number): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const samplesPerBar = Math.floor(channelData.length / barCount);
  const peaks: number[] = [];

  for (let i = 0; i < barCount; i++) {
    let max = 0;
    const start = i * samplesPerBar;
    const end = Math.min(start + samplesPerBar, channelData.length);
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks.push(max);
  }

  const globalMax = Math.max(...peaks, 0.01);
  return peaks.map(p => p / globalMax);
}

function extractPeaksFromBytes(data: ArrayBuffer, barCount: number): number[] {
  const bytes = new Uint8Array(data);
  const samplesPerBar = Math.max(1, Math.floor(bytes.length / barCount));
  const peaks: number[] = [];

  for (let i = 0; i < barCount; i++) {
    let max = 0;
    const start = i * samplesPerBar;
    const end = Math.min(start + samplesPerBar, bytes.length);
    for (let j = start; j < end; j++) {
      const val = Math.abs((bytes[j] - 128) / 128);
      if (val > max) max = val;
    }
    peaks.push(max);
  }

  const globalMax = Math.max(...peaks, 0.01);
  return peaks.map(p => p / globalMax);
}

// ── Waveform Canvas Drawing ─────────────────────────────────────────────────

function drawWaveform(
  canvas: HTMLCanvasElement,
  peaks: number[],
  progress: number,
  accentColor: string,
  mutedColor: string,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  const barCount = peaks.length;
  const totalBarWidth = BAR_WIDTH + BAR_GAP;
  const centerY = displayHeight / 2;
  const maxBarHeight = displayHeight * 0.8;
  const progressBarIndex = Math.floor(progress * barCount);

  for (let i = 0; i < barCount; i++) {
    const x = i * totalBarWidth;
    if (x > displayWidth) break;

    const barHeight = Math.max(2, peaks[i] * maxBarHeight);
    const y = centerY - barHeight / 2;
    const color = i <= progressBarIndex ? accentColor : mutedColor;

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, BAR_WIDTH, barHeight, 1.5);
    ctx.fill();
  }
}

// ── Audio Player Component ──────────────────────────────────────────────────

function AudioPlayer({ filePath, fileSize }: { filePath: string; fileSize: number }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [sampleRate, setSampleRate] = useState(0);
  const [channels, setChannels] = useState(0);
  const [decodedOk, setDecodedOk] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef(0);
  const rawDataRef = useRef<ArrayBuffer | null>(null);

  const ext = getExtension(filePath);
  const filename = filePath.split(/[/\\]/).pop() || '';

  // Compute bar count based on container width
  const getBarCount = useCallback(() => {
    if (!containerRef.current) return 200;
    const width = containerRef.current.clientWidth;
    return Math.floor(width / (BAR_WIDTH + BAR_GAP));
  }, []);

  // Load audio data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setDecodedOk(false);
    setPeaks([]);
    offsetRef.current = 0;

    api.files.read(filePath).then(async (buffer) => {
      if (cancelled) return;
      rawDataRef.current = buffer;

      try {
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const audioBuffer = await audioCtx.decodeAudioData(buffer.slice(0));
        if (cancelled) { audioCtx.close(); return; }

        audioBufferRef.current = audioBuffer;
        setSampleRate(audioBuffer.sampleRate);
        setChannels(audioBuffer.numberOfChannels);
        setDuration(audioBuffer.duration);
        setDecodedOk(true);

        const barCount = getBarCount();
        const peakData = extractPeaks(audioBuffer, barCount);
        setPeaks(peakData);
      } catch {
        if (cancelled) return;
        const barCount = getBarCount();
        const peakData = extractPeaksFromBytes(buffer, barCount);
        setPeaks(peakData);
        setDecodedOk(false);
      }

      setLoading(false);
    }).catch((err) => {
      if (!cancelled) {
        setError(String(err));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      stopPlayback();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [filePath]);

  // Redraw waveform on peaks/progress change
  useEffect(() => {
    if (!canvasRef.current || peaks.length === 0) return;
    const progress = duration > 0 ? currentTime / duration : 0;
    const style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--xp-blue').trim() || '#7aa2f7';
    const muted = style.getPropertyValue('--xp-surface-light').trim() || '#292e42';
    drawWaveform(canvasRef.current, peaks, progress, accent, muted);
  }, [peaks, currentTime, duration]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (!canvasRef.current) return;
      const barCount = getBarCount();
      if (audioBufferRef.current) {
        const peakData = extractPeaks(audioBufferRef.current, barCount);
        setPeaks(peakData);
      } else if (rawDataRef.current) {
        const peakData = extractPeaksFromBytes(rawDataRef.current, barCount);
        setPeaks(peakData);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [getBarCount]);

  // Update volume on gain node
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = volume;
    }
  }, [volume]);

  // Animation frame for playback position
  const tick = useCallback(() => {
    if (!audioCtxRef.current || !playing) return;
    const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
    const time = offsetRef.current + elapsed;
    if (time >= duration) {
      setPlaying(false);
      setCurrentTime(duration);
      offsetRef.current = 0;
      return;
    }
    setCurrentTime(time);
    rafRef.current = requestAnimationFrame(tick);
  }, [playing, duration]);

  useEffect(() => {
    if (playing) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, tick]);

  function stopPlayback() {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    cancelAnimationFrame(rafRef.current);
  }

  function startPlayback(offset: number) {
    if (!audioCtxRef.current || !audioBufferRef.current) return;
    stopPlayback();

    const source = audioCtxRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;

    const gain = audioCtxRef.current.createGain();
    gain.gain.value = volume;
    gainRef.current = gain;

    source.connect(gain);
    gain.connect(audioCtxRef.current.destination);

    source.onended = () => {
      if (sourceRef.current === source) {
        setPlaying(false);
        offsetRef.current = 0;
        setCurrentTime(0);
      }
    };

    startTimeRef.current = audioCtxRef.current.currentTime;
    offsetRef.current = offset;
    source.start(0, offset);
    sourceRef.current = source;
  }

  function togglePlay() {
    if (!decodedOk) return;
    if (playing) {
      const elapsed = audioCtxRef.current
        ? audioCtxRef.current.currentTime - startTimeRef.current
        : 0;
      offsetRef.current = offsetRef.current + elapsed;
      stopPlayback();
      setPlaying(false);
    } else {
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      startPlayback(offsetRef.current);
      setPlaying(true);
    }
  }

  function seekTo(fraction: number) {
    const time = fraction * duration;
    setCurrentTime(time);
    offsetRef.current = time;
    if (playing) {
      startPlayback(time);
    }
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canvasRef.current || duration <= 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    seekTo(fraction);
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setVolume(parseFloat(e.target.value));
  }

  function toggleMute() {
    setVolume(v => (v > 0 ? 0 : 0.8));
  }

  function VolumeIcon() {
    if (volume === 0) return <VolumeMuteIcon />;
    if (volume < 0.5) return <VolumeLowIcon />;
    return <VolumeHighIcon />;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 12, color: 'var(--xp-text-muted, #888)',
      }}>
        <div style={{
          width: 32, height: 32, border: '3px solid var(--xp-border, #333)',
          borderTopColor: 'var(--xp-blue, #7aa2f7)', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: 13 }}>Loading audio...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 8, padding: 16, color: 'var(--xp-red, #f7768e)', fontSize: 13,
      }}>
        <span style={{ fontWeight: 600 }}>Failed to load audio</span>
        <span style={{ color: 'var(--xp-text-muted, #888)', fontSize: 12, wordBreak: 'break-all', textAlign: 'center' as const }}>
          {error}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--xp-bg, #1a1b26)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
        borderBottom: '1px solid var(--xp-border, #333)',
      }}>
        <div style={{ color: 'var(--xp-blue, #7aa2f7)', flexShrink: 0 }}>
          <MusicNoteIcon />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--xp-text, #c0caf5)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
          }}>
            {filename}
          </div>
          <div style={{ fontSize: 11, color: 'var(--xp-text-muted, #888)', marginTop: 2 }}>
            {FORMAT_LABELS[ext] || ext.toUpperCase()}
            {fileSize > 0 && ` \u2022 ${formatSize(fileSize)}`}
          </div>
        </div>
      </div>

      {/* Waveform */}
      <div
        ref={containerRef}
        style={{
          flex: 1, padding: '12px 12px 0', cursor: decodedOk ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', minHeight: CANVAS_HEIGHT + 24,
        }}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            width: '100%', height: CANVAS_HEIGHT,
            borderRadius: 4,
          }}
        />
      </div>

      {/* Time display */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', padding: '4px 12px',
        fontSize: 11, color: 'var(--xp-text-muted, #888)', fontVariantNumeric: 'tabular-nums',
      }}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Progress bar */}
      <div
        style={{ padding: '0 12px', cursor: 'pointer' }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          seekTo(fraction);
        }}
      >
        <div style={{
          width: '100%', height: 4, borderRadius: 2,
          background: 'var(--xp-surface-light, #292e42)', position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
            height: '100%', borderRadius: 2,
            background: 'var(--xp-blue, #7aa2f7)',
            transition: playing ? 'none' : 'width 0.1s ease',
          }} />
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', borderTop: '1px solid var(--xp-border, #333)',
      }}>
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          disabled={!decodedOk}
          title={playing ? 'Pause' : 'Play'}
          style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none',
            background: decodedOk ? 'var(--xp-blue, #7aa2f7)' : 'var(--xp-surface-light, #292e42)',
            color: decodedOk ? '#fff' : 'var(--xp-text-muted, #888)',
            cursor: decodedOk ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background 0.15s ease',
          }}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
          <button
            onClick={toggleMute}
            title={volume === 0 ? 'Unmute' : 'Mute'}
            style={{
              background: 'none', border: 'none', padding: 2,
              color: 'var(--xp-text-muted, #888)', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
            }}
          >
            <VolumeIcon />
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            title={`Volume: ${Math.round(volume * 100)}%`}
            style={{
              width: 70, height: 4, appearance: 'none', background: 'var(--xp-surface-light, #292e42)',
              borderRadius: 2, outline: 'none', cursor: 'pointer',
              accentColor: 'var(--xp-blue, #7aa2f7)',
            }}
          />
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Not decodable warning */}
        {!decodedOk && (
          <span style={{ fontSize: 11, color: 'var(--xp-orange, #ff9e64)' }}>
            Format not decodable in browser
          </span>
        )}
      </div>

      {/* File info */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 12,
        padding: '8px 12px', borderTop: '1px solid var(--xp-border, #333)',
        fontSize: 11, color: 'var(--xp-text-muted, #888)',
      }}>
        {duration > 0 && (
          <InfoBadge label="Duration" value={formatTime(duration)} />
        )}
        {sampleRate > 0 && (
          <InfoBadge label="Sample Rate" value={formatSampleRate(sampleRate)} />
        )}
        {channels > 0 && (
          <InfoBadge label="Channels" value={channels === 1 ? 'Mono' : channels === 2 ? 'Stereo' : String(channels)} />
        )}
        <InfoBadge label="Format" value={FORMAT_LABELS[ext] || ext.toUpperCase()} />
      </div>
    </div>
  );
}

// ── Info Badge ──────────────────────────────────────────────────────────────

function InfoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <span style={{ color: 'var(--xp-text-muted, #888)' }}>{label}:</span>
      <span style={{ color: 'var(--xp-text, #c0caf5)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ── Button Style ────────────────────────────────────────────────────────────

function btnStyle(): React.CSSProperties {
  return {
    background: 'var(--xp-surface-light, #1e1e2e)',
    border: '1px solid var(--xp-border, #333)',
    borderRadius: 4,
    color: 'var(--xp-text, #c0caf5)',
    cursor: 'pointer',
    padding: '3px 8px',
    fontSize: 12,
    lineHeight: 1,
  };
}

// ── Extension Registration ──────────────────────────────────────────────────

let api: XplorerAPI;

Preview.register({
  id: 'audio-waveform',
  title: 'Audio Waveform',
  description: 'Audio player with waveform visualization',
  icon: 'music',
  permissions: ['file:read'],

  canPreview: (file) => !file.is_dir && isAudioFile(file.path),
  priority: 10,

  onActivate: (injectedApi) => { api = injectedApi; },

  render: (props) => {
    const selectedFiles = (props.selectedFiles || []) as FileEntry[];
    const audioFile = selectedFiles.find(f => isAudioFile(f.path));

    if (!audioFile) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', gap: 8, padding: 16, color: 'var(--xp-text-muted, #888)',
        }}>
          <div style={{ color: 'var(--xp-blue, #7aa2f7)' }}>
            <MusicNoteIcon />
          </div>
          <span style={{ fontSize: 13 }}>Select an audio file to preview</span>
          <span style={{ fontSize: 11, color: 'var(--xp-text-muted, #666)' }}>
            Supports MP3, WAV, OGG, FLAC, AAC, M4A, WMA
          </span>
        </div>
      );
    }

    return <AudioPlayer filePath={audioFile.path} fileSize={audioFile.size || 0} />;
  },
});
