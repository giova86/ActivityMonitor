/** Display formatting helpers shared by the dashboard components. */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

export function formatBytes(bytes, digits = 1) {
  if (!Number.isFinite(bytes)) return '—';
  const sign = bytes < 0 ? '-' : '';
  let n = Math.abs(bytes);
  let i = 0;
  while (n >= 1024 && i < UNITS.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${sign}${i === 0 ? String(Math.round(n)) : n.toFixed(digits)} ${UNITS[i]}`;
}

export function formatRate(bytesPerSec, digits = 1) {
  if (!Number.isFinite(bytesPerSec)) return '—';
  return `${formatBytes(bytesPerSec, digits)}/s`;
}

export function formatDuration(minutes) {
  if (minutes == null) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
