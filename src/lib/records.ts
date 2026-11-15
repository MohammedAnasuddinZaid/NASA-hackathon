import { records } from './corpus';
import type { ExperimentRecord } from './types';

export type SortKey =
  | 'id'
  | 'o2-asc'
  | 'o2-desc'
  | 'date'
  | 'material'
  | 'family'
  | 'thickness-asc'
  | 'thickness-desc'
  | 'flow-desc'
  | 'validation';

export interface AtlasFilters {
  query: string;
  family: string;
  material: string;
  quality: string;
  o2Min: number | null;
  o2Max: number | null;
  flowOnly: boolean;
  hasThickness: boolean;
  hasIgnition: boolean;
  sort: SortKey;
}

export const emptyFilters: AtlasFilters = {
  query: '',
  family: 'all',
  material: 'all',
  quality: 'all',
  o2Min: null,
  o2Max: null,
  flowOnly: false,
  hasThickness: false,
  hasIgnition: false,
  sort: 'id',
};

export function matchesQuery(record: ExperimentRecord, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;
  const haystack = [
    record.experiment_id,
    record.test_number,
    record.sample_number,
    record.material_raw,
    record.material_family,
    record.pi ?? '',
    record.investigation_acronym,
    record.source_id,
    record.date_reported ?? '',
    record.geometry,
    record.flow_direction.value ?? '',
    record.gravity_regime.value ?? '',
    record.ignition_method.value ?? '',
    record.hardware.value ?? '',
    record.outcome.value ?? '',
    ...record.measurements.flatMap((measurement) => [
      measurement.quantity,
      measurement.measurement_method ?? '',
      measurement.note ?? '',
    ]),
  ]
    .join(' ')
    .toLowerCase();
  return query.split(/\s+/).every((term) => haystack.includes(term));
}

/** Terms used for visible match highlighting. */
export function queryTerms(rawQuery: string): string[] {
  return [...new Set(rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean))];
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

/**
 * Case-insensitive, whitespace-tolerant highlighting. The returned parts are
 * plain strings and are rendered as text nodes, never as HTML.
 */
export function highlightParts(text: string, rawQuery: string): HighlightPart[] {
  const terms = queryTerms(rawQuery);
  if (!terms.length || !text) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const term of terms) {
    let index = lower.indexOf(term);
    while (index !== -1) {
      ranges.push([index, index + term.length]);
      index = lower.indexOf(term, index + term.length);
    }
  }
  if (!ranges.length) return [{ text, match: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts;
}

export function filterRecords(source: ExperimentRecord[], filters: AtlasFilters): ExperimentRecord[] {
  const query = filters.query.trim().toLowerCase();
  const exactIdMatches = query
    ? source.filter(
        (record) =>
          record.experiment_id.toLowerCase() === query || record.test_number.toLowerCase() === query,
      )
    : [];
  const pool = exactIdMatches.length ? exactIdMatches : source;
  const filtered = pool.filter((record) => {
    if (!matchesQuery(record, filters.query)) return false;
    if (filters.family !== 'all' && record.family !== filters.family) return false;
    if (filters.material !== 'all' && record.material_family !== filters.material) return false;
    if (filters.quality !== 'all' && record.validation_status !== filters.quality) return false;
    if (filters.flowOnly && record.flow_initial_cm_s.value === null) return false;
    if (filters.hasThickness && record.thickness_mm.value === null) return false;
    if (filters.hasIgnition && record.ignition_power_w.value === null) return false;
    const o2 = record.oxygen_initial_pct.value;
    if (filters.o2Min !== null && (o2 === null || o2 < filters.o2Min)) return false;
    if (filters.o2Max !== null && (o2 === null || o2 > filters.o2Max)) return false;
    return true;
  });

  return sortRecords(filtered, filters.sort);
}

const validationRank: Record<string, number> = { validated: 0, partial: 1, suspect: 2 };

/** Numeric sort with missing values last, independent of direction. */
function numericSort(
  copy: ExperimentRecord[],
  value: (record: ExperimentRecord) => number | null,
  direction: 'asc' | 'desc',
): ExperimentRecord[] {
  return copy.sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left === null && right === null) return a.experiment_id.localeCompare(b.experiment_id, undefined, { numeric: true });
    if (left === null) return 1;
    if (right === null) return -1;
    if (left === right) return a.experiment_id.localeCompare(b.experiment_id, undefined, { numeric: true });
    return direction === 'asc' ? left - right : right - left;
  });
}

export function sortRecords(source: ExperimentRecord[], sort: SortKey): ExperimentRecord[] {
  const copy = [...source];
  switch (sort) {
    case 'o2-asc':
      return numericSort(copy, (record) => record.oxygen_initial_pct.value, 'asc');
    case 'o2-desc':
      return numericSort(copy, (record) => record.oxygen_initial_pct.value, 'desc');
    case 'thickness-asc':
      return numericSort(copy, (record) => record.thickness_mm.value, 'asc');
    case 'thickness-desc':
      return numericSort(copy, (record) => record.thickness_mm.value, 'desc');
    case 'flow-desc':
      return numericSort(copy, (record) => record.flow_initial_cm_s.value, 'desc');
    case 'date':
      return copy.sort((a, b) => {
        if (a.date_reported === null && b.date_reported === null) return a.experiment_id.localeCompare(b.experiment_id, undefined, { numeric: true });
        if (a.date_reported === null) return 1;
        if (b.date_reported === null) return -1;
        return a.date_reported.localeCompare(b.date_reported) || a.experiment_id.localeCompare(b.experiment_id, undefined, { numeric: true });
      });
    case 'material':
      return copy.sort((a, b) => a.material_family.localeCompare(b.material_family) || a.experiment_id.localeCompare(b.experiment_id, undefined, { numeric: true }));
    case 'family':
      return copy.sort((a, b) => a.family.localeCompare(b.family) || a.experiment_id.localeCompare(b.experiment_id, undefined, { numeric: true }));
    case 'validation':
      return copy.sort((a, b) => (validationRank[a.validation_status] ?? 9) - (validationRank[b.validation_status] ?? 9) || a.experiment_id.localeCompare(b.experiment_id, undefined, { numeric: true }));
    case 'id':
    default:
      return copy.sort((a, b) => a.experiment_id.localeCompare(b.experiment_id, undefined, { numeric: true }));
  }
}

export function uniqueMaterials(source: ExperimentRecord[] = records): string[] {
  return [...new Set(source.map((record) => record.material_family))].sort((a, b) => a.localeCompare(b));
}

export function uniqueFamilies(source: ExperimentRecord[] = records): string[] {
  return [...new Set(source.map((record) => record.family))].sort();
}

export interface FieldCoverage {
  key: string;
  label: string;
  count: number;
  total: number;
  note: string;
}

export function fieldCoverage(source: ExperimentRecord[] = records): FieldCoverage[] {
  const total = source.length;
  const count = (predicate: (record: ExperimentRecord) => boolean) => source.filter(predicate).length;
  return [
    {
      key: 'oxygen_initial',
      label: 'Initial O2',
      count: count((record) => record.oxygen_initial_pct.value !== null),
      total,
      note: 'Saffire S1 uses a range midpoint; S2 retains an approximate single value.',
    },
    {
      key: 'oxygen_final',
      label: 'Final O2',
      count: count((record) => record.oxygen_final_pct.value !== null),
      total,
      note: 'Two BASS-II and both Saffire final O2 fields are absent; two reported BASS-II finals are flagged inconsistent.',
    },
    {
      key: 'pressure',
      label: 'Total pressure',
      count: count((record) => record.total_pressure_psia.value !== null),
      total,
      note: 'No pressure column exists in either experimental table.',
    },
    {
      key: 'flow',
      label: 'Air flow',
      count: count((record) => record.flow_initial_cm_s.value !== null),
      total,
      note: 'BASS-II values are slow-response instrument displays, not calibrated velocities.',
    },
    {
      key: 'gravity_measured',
      label: 'Per-test gravity',
      count: count((record) => record.gravity_regime.status === 'measured'),
      total,
      note: 'Gravity is assigned at investigation level only.',
    },
    {
      key: 'ignition',
      label: 'Ignition power',
      count: count((record) => record.ignition_power_w.value !== null),
      total,
      note: 'Only the two Saffire-I samples report ignition power and time.',
    },
    {
      key: 'thickness',
      label: 'Thickness',
      count: count((record) => record.thickness_mm.value !== null),
      total,
      note: 'Parsed from free-text material descriptions when present.',
    },
    {
      key: 'outcome',
      label: 'Standardized outcome',
      count: count((record) => record.outcome.status === 'measured'),
      total,
      note: 'No extinction or sustained-burning classification is reported.',
    },
  ];
}

export function missingCount(record: ExperimentRecord): number {
  return record.missing_fields.length;
}
