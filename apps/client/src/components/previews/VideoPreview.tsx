import React, { useEffect, useState, useRef, useCallback } from 'react';
import { PreviewProps } from '@/lib/preview-factory';
import { convertAssetUrl } from '@/lib/transport';
import { formatTime } from '@/lib/format-utils';

const VideoPreview = ({ file, onError, onLoad }: PreviewProps) => {
  const [videoError, setVideoError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Reset states when file changes
    setLoading(true);
    setVideoError(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    // Convert file path to Tauri asset URL
    const assetUrl = convertAssetUrl(file.path);
    setVideoSrc(assetUrl);
  }, [file.path]);

  const handleLoadedData = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      const dur = isNaN(video.duration) ? 0 : video.duration;
      setDuration(dur);
      setCurrentTime(video.currentTime);
    }
    setLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setVideoError(true);
    setLoading(false);
    onError?.(new Error('Failed to load video'));
  }, [onError]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleProgressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (video) {
      const time = parseFloat(e.target.value);
      video.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (video) {
      const vol = parseFloat(e.target.value);
      video.volume = vol;
      setVolume(vol);
    }
  }, []);

  const safeDuration = isNaN(duration) ? 0 : duration;
  const progressPercent = safeDuration > 0 ? (currentTime / safeDuration) * 100 : 0;

  return (
    <div className="flex h-full flex-col">
      {loading && (
        <div className="bg-xp-surface border-xp-border flex flex-1 items-center justify-center rounded border">
          <div className="text-xp-text-muted text-center">
            <div className="animate-pulse">
              <div className="bg-xp-bg mx-auto mb-2 h-16 w-16 rounded" />
              <p className="text-xs">Loading video...</p>
            </div>
          </div>
        </div>
      )}
      {!videoError && (
        <>
          <div
            className={`flex flex-1 items-center justify-center overflow-hidden bg-black ${loading ? 'hidden' : ''}`}
          >
            <video
              ref={videoRef}
              src={videoSrc}
              preload="metadata"
              className="max-h-full max-w-full object-contain"
              onLoadedData={handleLoadedData}
              onError={handleError}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
            />
          </div>
          {/* Custom Controls */}
          {!loading && (
            <div className="bg-xp-surface border-xp-border space-y-2 border-t px-3 py-2">
              {/* Progress bar */}
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
              {/* Play/Pause + Volume */}
              <div className="flex items-center justify-between">
                <button
                  onClick={togglePlay}
                  title={isPlaying ? 'Pause' : 'Play'}
                  className="hover:bg-xp-surface-light text-xp-text rounded p-1.5"
                >
                  {isPlaying ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
                <div className="flex items-center space-x-1">
                  <svg className="text-xp-text h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z"
                      clipRule="evenodd"
                    />
                    {volume > 0 && (
                      <path d="M14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z" />
                    )}
                    {volume > 0.5 && (
                      <path d="M12.828 4.929a1 1 0 011.414 0A5.983 5.983 0 0116 10a5.984 5.984 0 01-1.758 4.243 1 1 0 01-1.414-1.414A3.984 3.984 0 0014 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.414z" />
                    )}
                  </svg>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="h-1 w-20 cursor-pointer appearance-none rounded-full"
                    style={{
                      background: `linear-gradient(to right, #7aa2f7 0%, #7aa2f7 ${volume * 100}%, #1a1b26 ${volume * 100}%, #1a1b26 100%)`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {videoError && (
        <div className="bg-xp-surface border-xp-border flex flex-1 items-center justify-center rounded border">
          <div className="text-xp-text-muted text-center">
            <svg className="mx-auto mb-2 h-12 w-12" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm">Cannot preview video</p>
            <p className="mt-1 text-xs opacity-70">The video format may not be supported</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(VideoPreview);
