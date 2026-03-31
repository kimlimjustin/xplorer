/**
 * Format a number of seconds into a "M:SS" display string.
 * Shared by AudioPreview and VideoPreview.
 */
export const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Return Tailwind classes for a color-coded file-size badge.
 * Shared by DuplicateFinderPanel and RecommendationsPanel.
 */
export const sizeBadgeColor = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 100) return 'bg-xp-red/20 text-xp-red border-xp-red/30';
  if (bytes >= 1024 * 1024 * 10) return 'bg-xp-orange/20 text-xp-orange border-xp-orange/30';
  if (bytes >= 1024 * 1024) return 'bg-xp-yellow/20 text-xp-yellow border-xp-yellow/30';
  if (bytes >= 1024 * 100) return 'bg-xp-blue/20 text-xp-blue border-xp-blue/30';
  return 'bg-xp-surface text-xp-text-muted border-xp-border';
};
