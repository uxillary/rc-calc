export function parseKMB(input: string): number {
  const s = input.trim().toLowerCase().replace(/[, ]/g, '');
  const m = s.match(/^([0-9]*\.?[0-9]+)([kmb])?$/);
  if (!m) return Number(s);
  const val = parseFloat(m[1]);
  const mul = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : m[2] === 'b' ? 1e9 : 1;
  return Math.round(val * mul);
}

export function formatNumber(value: number | null | undefined, precision = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: precision });
}

export function formatShortNumber(value: number, precision = 2): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(precision)}b`;
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(precision)}m`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(precision)}k`;
  }
  return value.toFixed(precision);
}
