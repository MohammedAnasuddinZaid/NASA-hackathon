import type { DataValue, ValueStatus } from './types';

export function isMissing(value: { value: unknown } | null | undefined): boolean {
  return !value || value.value === null || value.value === undefined || value.value === '';
}

export function formatNumber(value: number, maxDigits = 3): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : maxDigits;
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function formatValue(
  data: DataValue<number> | DataValue<string> | null | undefined,
  unitOverride?: string,
  maxDigits = 3,
): string {
  if (!data || data.value === null || data.value === undefined) return 'Not reported';
  const value = typeof data.value === 'number' ? formatNumber(data.value, maxDigits) : data.value;
  const unit = unitOverride ?? data.unit;
  return unit ? `${value} ${unit}` : String(value);
}

export function formatCompact(
  data: DataValue<number> | DataValue<string> | null | undefined,
  unitOverride?: string,
  maxDigits = 3,
): string {
  if (!data || data.value === null || data.value === undefined) return '—';
  const value = typeof data.value === 'number' ? formatNumber(data.value, maxDigits) : data.value;
  const unit = unitOverride ?? data.unit;
  return unit ? `${value} ${unit}` : String(value);
}

export function statusLabel(status: ValueStatus): string {
  const labels: Record<string, string> = {
    measured: 'Reported',
    derived: 'Derived',
    reported_qualitative: 'Reported · approximate',
    reported_flag: 'Reported · flag',
    over_range: 'Reported · over range',
    not_reported: 'Not reported',
    investigation_level: 'Investigation level',
    not_applicable: 'Not applicable',
  };
  return labels[status] ?? status.replaceAll('_', ' ');
}

export type StatusTone = 'reported' | 'derived' | 'missing' | 'context' | 'warning';

export function statusTone(status: ValueStatus): StatusTone {
  if (status === 'measured' || status === 'reported_qualitative' || status === 'reported_flag') return 'reported';
  if (status === 'derived') return 'derived';
  if (status === 'investigation_level') return 'context';
  if (status === 'over_range') return 'warning';
  return 'missing';
}

export function humanizeToken(token: string): string {
  return token
    .replaceAll('_', ' ')
    .replace(/\bo2\b/gi, 'O2')
    .replace(/\bco2\b/gi, 'CO2')
    .replace(/\bco\b/gi, 'CO')
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return 'Not reported';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function shortIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

export function pct(part: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

export function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
