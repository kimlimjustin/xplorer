import { describe, it, expect } from 'vitest';
import {
  cn,
  safeImageUrl,
  formatFileSize,
  formatDate,
  formatDownloadCount,
  formatPrice,
} from '@/lib/utils';

// ---------------------------------------------------------------------------
// safeImageUrl
// ---------------------------------------------------------------------------
describe('safeImageUrl', () => {
  it('allows https URLs', () => {
    expect(safeImageUrl('https://example.com/icon.png')).toBe('https://example.com/icon.png');
  });

  it('allows https URLs with paths and query params', () => {
    expect(safeImageUrl('https://cdn.example.com/images/icon.png?w=100')).toBe(
      'https://cdn.example.com/images/icon.png?w=100',
    );
  });

  it('rejects javascript: URLs', () => {
    expect(safeImageUrl('javascript:alert(1)')).toBe('/placeholder-icon.png');
  });

  it('rejects javascript: URLs with mixed case', () => {
    expect(safeImageUrl('JavaScript:alert(1)')).toBe('/placeholder-icon.png');
  });

  it('rejects data: URLs', () => {
    expect(safeImageUrl('data:text/html,<script>alert(1)</script>')).toBe('/placeholder-icon.png');
  });

  it('rejects data: image URLs', () => {
    expect(safeImageUrl('data:image/png;base64,abc')).toBe('/placeholder-icon.png');
  });

  it('rejects http: URLs (non-secure)', () => {
    expect(safeImageUrl('http://example.com/icon.png')).toBe('/placeholder-icon.png');
  });

  it('rejects ftp: URLs', () => {
    expect(safeImageUrl('ftp://example.com/icon.png')).toBe('/placeholder-icon.png');
  });

  it('handles null', () => {
    expect(safeImageUrl(null)).toBe('/placeholder-icon.png');
  });

  it('handles undefined', () => {
    expect(safeImageUrl(undefined)).toBe('/placeholder-icon.png');
  });

  it('handles empty string', () => {
    expect(safeImageUrl('')).toBe('/placeholder-icon.png');
  });

  it('handles invalid URLs (no protocol)', () => {
    expect(safeImageUrl('not a url')).toBe('/placeholder-icon.png');
  });

  it('handles whitespace-only string', () => {
    expect(safeImageUrl('   ')).toBe('/placeholder-icon.png');
  });
});

// ---------------------------------------------------------------------------
// cn (className utility)
// ---------------------------------------------------------------------------
describe('cn', () => {
  it('merges multiple class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'extra')).toBe('base extra');
  });

  it('deduplicates conflicting Tailwind classes', () => {
    // tailwind-merge should resolve px-2 + px-4 to px-4
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('handles undefined and null values', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b');
  });
});

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------
describe('formatFileSize', () => {
  it('formats zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500.0 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
  });

  it('formats fractional sizes', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  it('formats a date string to long format', () => {
    const result = formatDate('2026-01-15');
    expect(result).toContain('January');
    expect(result).toContain('15');
    expect(result).toContain('2026');
  });

  it('formats another date', () => {
    const result = formatDate('2025-12-25');
    expect(result).toContain('December');
    expect(result).toContain('25');
    expect(result).toContain('2025');
  });
});

// ---------------------------------------------------------------------------
// formatDownloadCount
// ---------------------------------------------------------------------------
describe('formatDownloadCount', () => {
  it('returns raw number for counts under 1000', () => {
    expect(formatDownloadCount(42)).toBe('42');
    expect(formatDownloadCount(999)).toBe('999');
  });

  it('formats thousands with K suffix', () => {
    expect(formatDownloadCount(1000)).toBe('1.0K');
    expect(formatDownloadCount(1500)).toBe('1.5K');
    expect(formatDownloadCount(50000)).toBe('50.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatDownloadCount(1000000)).toBe('1.0M');
    expect(formatDownloadCount(2500000)).toBe('2.5M');
  });
});

// ---------------------------------------------------------------------------
// formatPrice
// ---------------------------------------------------------------------------
describe('formatPrice', () => {
  it('formats cents to dollar string', () => {
    expect(formatPrice(999)).toBe('$9.99');
  });

  it('formats zero', () => {
    expect(formatPrice(0)).toBe('$0.00');
  });

  it('formats exact dollars', () => {
    expect(formatPrice(1000)).toBe('$10.00');
  });
});
