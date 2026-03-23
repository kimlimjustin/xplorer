import React, { useMemo } from 'react';
import type { FileEntry } from '@/lib/tauri-api';

interface SizeDistributionChartProps {
  files: FileEntry[];
}

/**
 * A compact inline size distribution mini-chart for the status bar.
 * Shows 4 colored segments proportional to the number of files in each
 * size percentile bucket: Largest (red), Large (orange), Medium (yellow), Small (green).
 */
export const SizeDistributionChart = React.memo(({ files }: SizeDistributionChartProps) => {
  const distribution = useMemo(() => {
    // Only consider non-directory files with size > 0
    const fileSizes = files
      .filter((f) => !f.is_dir && f.size > 0)
      .map((f) => f.size)
      .sort((a, b) => a - b);

    const count = fileSizes.length;
    if (count === 0) return null;

    let largest = 0;
    let large = 0;
    let medium = 0;
    let small = 0;

    for (let i = 0; i < count; i++) {
      const percentile = ((i + 1) / count) * 100;
      if (percentile >= 90) largest++;
      else if (percentile >= 75) large++;
      else if (percentile >= 50) medium++;
      else small++;
    }

    return { largest, large, medium, small, total: count };
  }, [files]);

  if (!distribution || distribution.total === 0) return null;

  const { largest, large, medium, small, total } = distribution;

  const segments = [
    { count: small, color: '#22c55e', label: 'Small' },
    { count: medium, color: '#eab308', label: 'Medium' },
    { count: large, color: '#f97316', label: 'Large' },
    { count: largest, color: '#ef4444', label: 'Largest' },
  ].filter((s) => s.count > 0);

  const chartTitle = segments.map((s) => `${s.label}: ${s.count}`).join(', ');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span
        style={{
          color: 'var(--xp-text-muted)',
          fontSize: 11,
          whiteSpace: 'nowrap',
        }}
      >
        Size:
      </span>
      <div
        title={`Size Distribution — ${chartTitle}`}
        style={{
          display: 'flex',
          width: 80,
          height: 6,
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid var(--xp-border)',
          cursor: 'default',
        }}
      >
        {segments.map((segment) => (
          <div
            key={segment.label}
            style={{
              width: `${(segment.count / total) * 100}%`,
              height: '100%',
              backgroundColor: segment.color,
              transition: 'width 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
});
SizeDistributionChart.displayName = 'SizeDistributionChart';
