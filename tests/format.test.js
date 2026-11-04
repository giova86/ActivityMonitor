import { describe, it, expect } from 'vitest';
import { formatBytes, formatRate, formatDuration, clamp } from '../src/lib/format.js';

describe('formatBytes', () => {
  it('formats bytes below a kilobyte as whole bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes with one decimal', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats gigabytes with one decimal by default', () => {
    expect(formatBytes(21.4 * 1024 ** 3)).toBe('21.4 GB');
  });

  it('uses a custom digit count when given', () => {
    expect(formatBytes(21.37 * 1024 ** 3, 2)).toBe('21.37 GB');
  });
});

describe('formatRate', () => {
  it('formats bytes per second with a /s suffix', () => {
    expect(formatRate(1.2 * 1024 ** 2)).toBe('1.2 MB/s');
    expect(formatRate(140 * 1024)).toBe('140.0 KB/s');
  });
});

describe('formatDuration', () => {
  it('formats minutes as hours and minutes', () => {
    expect(formatDuration(372)).toBe('6h 12m');
  });

  it('omits the hour part under one hour', () => {
    expect(formatDuration(65)).toBe('1h 05m');
    expect(formatDuration(45)).toBe('45m');
  });

  it('returns null for null input', () => {
    expect(formatDuration(null)).toBeNull();
  });
});

describe('clamp', () => {
  it('clamps values into the given range', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(50, 0, 100)).toBe(50);
    expect(clamp(120, 0, 100)).toBe(100);
  });
});
