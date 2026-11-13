import { records } from './corpus';
import type { ExperimentRecord } from './types';

export type SortKey = 'id' | 'o2-asc' | 'o2-desc' | 'date' | 'material';

export interface AtlasFilters {
  query: string;
  family: string;
  material: string;
  quality: string;
  o2Min: number | null;
  o2Max: number | null;
  flowOnly: boolean;
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
  ]
    .join(' ')
    .toLowerCase();
  return query.split(/\s+/).every((term) => haystack.includes(term));
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
    const o2 = record.oxygen_initial_pct.value;
    if (filters.o2Min !== null && (o2 === null || o2 < filters.o2Min)) return false;
    if (filters.o2Max !== null && (o2 === null || o2 > filters.o2Max)) return false;
    return true;
  });

  return sortRecords(filtered, filters.sort);
}

export function sortRecords(source: ExperimentRecord[], sort: SortKey): ExperimentRecord[] {
  const copy = [...source];
  switch (sort) {
    case 'o2-asc':
      return copy.sort((a, b) => (a.oxygen_initial_pct.value ?? 999) - (b.oxygen_initial_pct.value ?? 999));
    case 'o2-desc':
      return copy.sort((a, b) => (b.oxygen_initial_pct.value ?? -1) - (a.oxygen_initial_pct.value ?? -1));
    case 'date':
      return copy.sort((a, b) => (a.date_reported ?? '').localeCompare(b.date_reported ?? ''));
    case 'material':
      return copy.sort((a, b) => a.material_family.localeCompare(b.material_family));
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
      note: 'Two Saffire values are approximate midpoints of reported ranges.',
    },
    {
      key: 'oxygen_final',
      label: 'Final O2',
      count: count((record) => record.oxygen_final_pct.value !== null),
      total,
      note: 'Four BASS-II finals are absent; two more are flagged inconsistent.',
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
